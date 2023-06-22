use crate::get_spaces_dir;
use crate::utils::u2b;
use crate::{api::CoreEvent, invalidate_query, space::Space};
use std::hash::{Hash, Hasher};
use std::vec;

use custom_prisma::prisma::{file, space as db_space, task};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;

use anyhow::bail;
use anyhow::{Context, Result};
use axum;
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

const VECTOR_DB_PATH: &str = "vector_db";
const LEARN_URL: &str = "http://localhost:5001/learn";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LearnRequest {
    vector_db_path: String,
    file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LearnFileTaskState {
    file_rel_path: String,
}

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

        let file = space
            .db
            .file()
            .find_unique(file::id::equals(u2b(info.file_id)))
            .exec()
            .await?;
        let file = file.context("Failed to find file")?;
        let file_path = file.path.clone();
        task_info.data = Some(LearnFileTaskState {
            file_rel_path: file_path,
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
        let file_path = data.file_rel_path.clone();

        let space_base_path = get_spaces_dir().await;
        let space_path = space_base_path.join(space.id.to_string());

        let vector_db_path = space_path.join(VECTOR_DB_PATH);
        let file_path = space_path.join(file_path);
        // create if not exists
        if !vector_db_path.exists() {
            std::fs::create_dir(&vector_db_path)?;
        }

        let learn_request = LearnRequest {
            vector_db_path: vector_db_path.to_string_lossy().into_owned(),
            file_path: file_path.to_string_lossy().into_owned(),
        };

        debug!("Sending learn request: {:?}", learn_request);

        let client = Client::new();
        let res = client
            .post(LEARN_URL)
            .json(&learn_request)
            .send()
            .await
            .context("Failed to send learn request")?;

        if !res.status().is_success() {
            bail!("Failed to learn file");
        }

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

        Ok(())
    }
}
