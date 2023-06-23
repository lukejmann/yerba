use crate::utils::{u2b, u2s};
use crate::{api::CoreEvent, invalidate_query, space::Space};
use std::hash::{Hash, Hasher};

use custom_prisma::prisma::message::{self};
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

pub struct ReplyTask {}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct ReplyTaskInfo {
    pub message_id: Uuid,
}

impl Hash for ReplyTaskInfo {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.message_id.hash(state);
    }
}

impl TaskInfo for ReplyTaskInfo {
    type Task = ReplyTask;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplyTaskState {
    message_id: Uuid,
    error: Option<String>,
}

#[async_trait::async_trait]
impl TaskExec for ReplyTask {
    type Info = ReplyTaskInfo;
    type Data = ReplyTaskState;
    const TYPE: &'static str = "reply";

    fn new() -> Self {
        Self {}
    }

    async fn setup(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("reply::setup");
        let Space { .. } = space;
        let info = task_info.info.clone();

        let message_id = info.message_id;

        // create response message with status "generating"
        let response_message_id = Uuid::new_v4();
        let response_message_data = space
            .db
            .message()
            .create(
                u2b(response_message_id),
                u2s(response_message_id),
                "Generating response...".to_string(),
                db_space::id::equals(u2b(space.id)),
                vec![
                    message::response_status::set(1),
                    message::user_message::connect(message::id::equals(u2b(message_id))),
                ],
            )
            .exec()
            .await?;

        Ok(())
    }

    async fn run(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("reply::run");
        // scan the path every 200ms and update the file size. If the file size is the same for 1s, then we can assume the file is done uploading

        // let info = task_info.info.clone();
        // let mut last_size: i32 = 0;
        // let mut stable_since = Instant::now();

        // let data = task_info
        //     .data
        //     .as_mut()
        //     .context("Failed to get upload task data")?;

        // loop {
        //     // Pause for a short period
        //     tokio::time::sleep(Duration::from_millis(100)).await;

        //     let space_path = space.path().await;
        //     let path = space_path.join(&info.path);

        //     // Get the current file size
        //     let current_size = metadata(&path)
        //         .context(format!("Failed to get file size for {:?}", info.path))?
        //         .len()
        //         .try_into()?;

        //     if current_size == last_size {
        //         // If the size is unchanged, check how long it has been stable
        //         if stable_since.elapsed() > Duration::from_secs(1) {
        //             // If it's been stable for 1s or more, the upload is complete
        //             break;
        //         }
        //     } else {
        //         // If the size has changed, update the size and the stable_since time
        //         last_size = current_size;
        //         stable_since = Instant::now();

        //         // Update the file size in the database
        //         let res = space
        //             .db
        //             .file()
        //             .update(
        //                 file::id::equals(u2b(data.file_id)),
        //                 vec![file::size::set(current_size)],
        //             )
        //             .exec()
        //             .await;

        //         if let Err(e) = res {
        //             bail!("Failed to update file size: {}", e);
        //         }
        //     }
        // }

        Ok(())
    }
    async fn finish(
        &self,
        space: &Space,
        task_id: Uuid,
        _task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        // info!("reply::finish");
        // invalidate_query!(space, "files.list");

        Ok(())
    }
}
