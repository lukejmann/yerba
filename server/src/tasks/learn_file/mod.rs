use crate::get_spaces_dir;
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

use uuid::Uuid;

use super::{TaskExec, TaskInfo, TaskState};

pub struct LearnFileTask {}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct LearnFileTaskInfo {
    pub file_id: Uuid,
}

impl Hash for LearnFileTaskInfo {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.file_id.hash(state);
    }
}

impl TaskInfo for LearnFileTaskInfo {
    type Task = LearnFileTask;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LearnFileTaskState {
    relative_path: String,
}

static SCRIPTS_PATH: &str = "/Users/two/yerba/server/python";

// TODO: fix embedding
// static SCRIPTS_DIR: include_dir::Dir<'static> = include_dir::include_dir!(SCRIPTS_PATH);

#[async_trait::async_trait]
impl TaskExec for LearnFileTask {
    type Info = LearnFileTaskInfo;
    type Data = LearnFileTaskState;
    const TYPE: &'static str = "learn_file";

    fn new() -> Self {
        Self {}
    }

    async fn setup(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("learn_file::setup");
        let Space { .. } = space;
        let info = task_info.info.clone();

        // let file_new_id = Uuid::new_v4();
        // let mut name = info.path.split('/').last().unwrap();
        // let extension = name.split('.').last().unwrap();
        // name = name.split('.').next().unwrap();

        let file_data = space
            .db
            .file()
            .find_unique(file::id::equals(u2b(info.file_id)))
            .exec()
            .await
            .with_context(|| format!("Failed to find file with id: {}", info.file_id))?;
        let file_data = file_data.context("Failed to find file")?;

        debug!("Created file: {:?}", file_data);

        task_info.data = Some(LearnFileTaskState {
            relative_path: file_data.path,
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
        debug!("learn_file::run");

        let data = task_info
            .data
            .as_mut()
            .context("Failed to get upload task data")?;
        let file_path = data.relative_path.clone();

        // call python
        let space_base_path = get_spaces_dir().await;
        let space_path = space_base_path.join(space.id.to_string());

        // TODO: implement

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
        _task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        info!("learn_file::finish");
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
