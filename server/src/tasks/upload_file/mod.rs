use crate::utils::u2b;
use crate::{api::CoreEvent, invalidate_query, space::Space};
use std::hash::{Hash, Hasher};

use custom_prisma::prisma::{file, space as db_space, task};
use serde::{Deserialize, Serialize};
use specta::Type;

use anyhow::bail;
use anyhow::{Context, Result};
use std::fs::metadata;
use std::time::{Duration, Instant};
use tracing::{debug, info};
use tracing_subscriber::field::debug;
use uuid::Uuid;

use super::{Task, TaskExec, TaskInfo, TaskState};

pub struct FileUploadTask {}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct FileUploadTaskInfo {
    pub path: String,
}

impl Hash for FileUploadTaskInfo {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.path.hash(state);
    }
}

impl TaskInfo for FileUploadTaskInfo {
    type Task = FileUploadTask;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadTaskState {
    file_id: Uuid,
}

#[async_trait::async_trait]
impl TaskExec for FileUploadTask {
    type Info = FileUploadTaskInfo;
    type Data = FileUploadTaskState;
    const TYPE: &'static str = "file_upload";

    fn new() -> Self {
        Self {}
    }

    async fn setup(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("upload_file::setup");
        let Space { .. } = space;
        let info = task_info.info.clone();

        let file_new_id = Uuid::new_v4();
        let mut name = info.path.split('/').last().unwrap();
        let extension = name.split('.').last().unwrap();
        name = name.split('.').next().unwrap();

        let file_data = space
            .db
            .file()
            .create(
                u2b(file_new_id),
                info.path.to_string(),
                name.to_string(),
                extension.to_string(),
                db_space::id::equals(u2b(space.clone().id)),
                vec![file::tasks::connect(vec![task::id::equals(u2b(task_id))])],
            )
            .exec()
            .await?;

        debug!("Created file: {:?}", file_data);

        task_info.data = Some(FileUploadTaskState {
            file_id: file_new_id,
        });

        // TODO: Dislike this update flow. Will refactor
        let task_data = space
            .db
            .task()
            .find_unique(task::id::equals(u2b(task_id)))
            .exec()
            .await
            .with_context(|| "Failed to find task")?
            .context("Failed to find task")?;

        space.emit(CoreEvent::TaskUpdate {
            tasks: vec![task_data],
        });

        Ok(())
    }

    async fn run(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("upload_file::run");
        // scan the path every 200ms and update the file size. If the file size is the same for 1s, then we can assume the file is done uploading

        let info = task_info.info.clone();
        let mut last_size: i32 = 0;
        let mut stable_since = Instant::now();

        let data = task_info
            .data
            .as_mut()
            .context("Failed to get upload task data")?;

        loop {
            // Pause for a short period
            tokio::time::sleep(Duration::from_millis(100)).await;

            // Get the current file size
            let current_size = metadata(&info.path)
                .context("Failed to get metadata")?
                .len()
                .try_into()?;

            if current_size == last_size {
                // If the size is unchanged, check how long it has been stable
                if stable_since.elapsed() > Duration::from_secs(1) {
                    // If it's been stable for 1s or more, the upload is complete
                    break;
                }
            } else {
                // If the size has changed, update the size and the stable_since time
                last_size = current_size;
                stable_since = Instant::now();

                // Update the file size in the database
                let res = space
                    .db
                    .file()
                    .update(
                        file::id::equals(u2b(data.file_id)),
                        vec![file::size::set(current_size)],
                    )
                    .exec()
                    .await;

                if let Err(e) = res {
                    bail!("Failed to update file size: {}", e);
                }
            }
        }

        // TODO: Dislike this update flow. Will refactor
        let task_data = space
            .db
            .task()
            .find_unique(task::id::equals(u2b(task_id)))
            .exec()
            .await
            .with_context(|| "Failed to find task")?
            .context("Failed to find task")?;

        space.emit(CoreEvent::TaskUpdate {
            tasks: vec![task_data],
        });

        Ok(())
    }
    async fn finish(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        info!("upload_file::finish");
        invalidate_query!(space, "files.list");

        // TODO: Dislike this update flow. Will refactor
        let task_data = space
            .db
            .task()
            .find_unique(task::id::equals(u2b(task_id)))
            .exec()
            .await
            .with_context(|| "Failed to find task")?
            .context("Failed to find task")?;

        debug!("Task data: {:?}", task_data);

        space.emit(CoreEvent::TaskUpdate {
            tasks: vec![task_data],
        });
        Ok(())
    }
}
