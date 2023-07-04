use crate::{
    api::{message_with_tasks_and_peer, CoreEvent},
    get_spaces_dir,
    tasks::{dispatcher::Dispatcher, IntoTask},
    utils::u2b,
    NodeContext,
};
use serde::{Deserialize, Serialize};
use specta::Type;

use std::{
    fmt::{Debug, Formatter},
    path::PathBuf,
    sync::Arc,
};

use custom_prisma::prisma::{meta, PrismaClient};

use tracing::warn;
use uuid::Uuid;

use std::f32::consts::E;
use std::ops::Sub;

use anyhow::{anyhow, bail, Context, Error, Result};
use custom_prisma::prisma::message;
use custom_prisma::prisma::{file, space as db_space, task};
use prisma_client_rust::schema::constants::ordering::SORT_ORDER;
use rspc::alpha::AlphaRouter;

use tracing::debug;

use crate::invalidate_query;
use crate::tasks::reply::ReplyTaskInfo;
use crate::utils::u2s;

#[derive(Clone)]
pub struct Space {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub meta: meta::Data,
    pub db: Arc<PrismaClient>,
    pub dispatcher: Arc<Dispatcher>,
    pub(super) node_context: NodeContext,
}

impl Debug for Space {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SpaceContext")
            .field("id", &self.id)
            .field("meta", &self.meta)
            .field("owner_id", &self.owner_id)
            .field("db", &self.db)
            .finish()
    }
}

impl Space {
    pub(crate) fn emit(&self, event: CoreEvent) {
        if let Err(e) = self.node_context.event_bus_tx.send(event) {
            warn!("Error sending event to event bus: {e:?}");
        }
    }

    pub(crate) async fn path(&self) -> PathBuf {
        let spaces_dir = get_spaces_dir().await;
        spaces_dir.join(self.id.to_string())
    }
}

impl Space {
    pub async fn receieve_msg_from_user(
        &self,
        msg: String,
    ) -> Result<message_with_tasks_and_peer::Data> {
        let latest_messages = self
            .db
            .message()
            .find_many(vec![message::space_id::equals(u2b(self.id))])
            .order_by(message::date_created::order(
                custom_prisma::prisma::SortOrder::Desc,
            ))
            .take(100)
            .exec()
            .await?;

        let id = Uuid::new_v4();

        let message = self
            .db
            .message()
            .create(
                u2b(id),
                u2s(id),
                msg,
                db_space::id::equals(u2b(self.clone().id)),
                vec![],
            )
            .include(message_with_tasks_and_peer::include())
            .exec()
            .await?;

        debug!("Created message {:?}", message);

        let reply_task = ReplyTaskInfo {
            message_id: id,
            message_text: message.text.clone(),
        };
        let task_res = self
            .clone()
            .dispatcher
            .dispatch(&self, reply_task.clone().runnable())
            .await?;

        Ok(message)
    }
}

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct SpaceWrapped {
    pub id: Uuid,
    pub meta: meta::Data,
}
