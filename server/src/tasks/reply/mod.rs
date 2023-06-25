use crate::api::message_with_tasks_and_peer;
use crate::get_spaces_dir;
use crate::utils::{u2b, u2s};
use crate::{api::CoreEvent, invalidate_query, space::Space};
use std::hash::{Hash, Hasher};
use std::vec;

use custom_prisma::prisma::message::{self};
use custom_prisma::prisma::{file, space as db_space, task};
use reqwest::Client;
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
    pub message_text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AskRequest {
    vector_db_path: String,
    question: String,
    chat_history: String,
}

// JSON:
//         [
// 	{ "HUMAN": "Hello", "AI": "Hi! How can I assist you today?" },
// 	{ "HUMAN": "Say that in german please", "AI": "" }
// ]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatHistoryEntry {
    pub HUMAN: String,
    pub AI: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AskResponse {
    pub success: bool,
    pub response_error: Option<String>,
    pub result: Option<String>,
}

impl Hash for ReplyTaskInfo {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.message_id.hash(state);
    }
}

impl TaskInfo for ReplyTaskInfo {
    type Task = ReplyTask;
}
pub(crate) const ASK_URL: &str = "http://localhost:5001/ask";

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplyTaskState {
    message_id: Uuid,
    response_message_id: Uuid,
    message_text: String,
    response_text: Option<String>,
    response_error: Option<String>,
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
        // attach the task to the message
        let response_message_data = space
            .db
            .message()
            .update(
                message::id::equals(u2b(message_id)),
                vec![message::tasks::connect(vec![task::id::equals(u2b(
                    task_id,
                ))])],
            )
            .exec()
            .await?;

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
                    message::is_user_message::set(false),
                    message::response_status::set(1),
                    message::user_message::connect(message::id::equals(u2b(message_id))),
                    message::tasks::connect(vec![task::id::equals(u2b(task_id))]),
                ],
            )
            .exec()
            .await?;

        task_info.data = Some(ReplyTaskState {
            message_id,
            response_message_id,
            message_text: info.message_text,
            response_text: None,
            response_error: None,
        });

        Ok(())
    }

    async fn run(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("reply::run");
        let data = task_info
            .data
            .as_mut()
            .context("Failed to get upload task data")?;

        let space_base_path = get_spaces_dir().await;
        let space_path = space_base_path.join(space.id.to_string());
        let vector_db_path = space_path.join("vector_db");

        let mut chat_history = space
            .db
            .message()
            .find_many(vec![
                message::is_user_message::equals(true),
                message::response_status::equals(2),
                message::space_id::equals(u2b(space.id)),
            ])
            // .include(message_with_tasks_and_peer::include())
            .order_by(message::date_created::order(
                custom_prisma::prisma::SortOrder::Desc,
            ))
            .take(10)
            .include(message_with_tasks_and_peer::include())
            .exec()
            .await?;
        // now we need to reverse the order of the messages
        let mut chat_history = chat_history.into_iter().rev().collect::<Vec<_>>();

        // now we need to format the chat history into the format that the vector db expects
        let chat_history = chat_history
            .iter_mut()
            .map(|message| {
                // if the message has a response, the response is the AI message. otherwise it's an empty string
                // the human message is always the message text
                ChatHistoryEntry {
                    HUMAN: message.clone().text.clone(),
                    AI: message
                        .clone()
                        .response_message
                        .map(|response| response.text.clone())
                        .unwrap_or("".to_string()),
                }
            })
            .collect::<Vec<_>>();

        let mut chat_history = serde_json::to_string(&chat_history)
            .context("Failed to serialize chat history to json")?;

        let ask_request = AskRequest {
            vector_db_path: vector_db_path.to_string_lossy().into_owned(),
            question: data.message_text.clone(),
            chat_history: chat_history,
        };

        debug!("Sending ask request: {:?}", ask_request);

        let client = Client::new();
        let res = client
            .post(ASK_URL)
            .json(&ask_request)
            .send()
            .await
            .context("Failed to send ask request")?;

        let ask_response: AskResponse = res.json().await.context("Failed to parse ask response")?;

        task_info.data = Some(ReplyTaskState {
            message_id: data.message_id,
            response_message_id: data.response_message_id,
            message_text: data.message_text.clone(),
            response_text: ask_response.result,
            response_error: ask_response.response_error,
        });

        Ok(())
    }
    async fn finish(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()> {
        debug!("reply::finish");

        let data = task_info
            .data
            .as_mut()
            .context("Failed to get upload task data")?;

        let response = data.response_text.clone();

        // set response_message.response_status to 3 if response_error
        // set response_message.text to response_error message
        // set date_finalized on both messages

        let response_message_data = space
            .db
            .message()
            .update(
                message::id::equals(u2b(data.response_message_id)),
                // db_space::id::equals(u2b(space.id)),
                vec![
                    message::text::set(
                        response
                            .clone()
                            .unwrap_or(data.response_error.clone().unwrap_or("".to_string())),
                    ),
                    message::response_status::set(if data.response_error.is_some() {
                        3
                    } else {
                        2
                    }),
                    message::date_finalized::set(chrono::Utc::now().into()),
                ],
            )
            .exec()
            .await?;

        let message_data = space
            .db
            .message()
            .update(
                message::id::equals(u2b(data.message_id)),
                // db_space::id::equals(u2b(space.id)),
                vec![
                    message::response_status::set(if data.response_error.is_some() {
                        3
                    } else {
                        2
                    }),
                    message::date_finalized::set(chrono::Utc::now().into()),
                ],
            )
            .exec()
            .await?;

        Ok(())
    }
}
