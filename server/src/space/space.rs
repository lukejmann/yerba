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

// // create constructor which creates the space and dispatcher
// impl Space {
//     pub(crate) async fn new(node_context: NodeContext, space: space::Data) -> Arc<Self> {
//         let dispatcher = Dispatcher::new(Self);

//         Arc::new(Self {
//             id: Uuid::from_slice(&space.id).unwrap(),
//             owner_id: Uuid::from_slice(&space.owner.id).unwrap(),
//             meta: space.meta,
//             db: node_context.db.clone(),
//             dispatcher: dispatcher.clone(),
//             node_context,
//         })
//     }
// }

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
    // TODO: update
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
    // TODO: update
    pub async fn receieve_msg_from_user(&self, msg: String) -> Result<()> {
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

        // if there are 10 more messages with msg.user_message == true than msg.user_message == false, we can't create a new message until the system has responded to the user
        // let mut user_message_count = 0;
        // let mut system_message_count = 0;
        // // let oldest:
        // for message in latest_messages.clone() {
        //     if message.is_user_message {
        //         user_message_count += 1;
        //     } else {
        //         system_message_count += 1;
        //     }
        // }

        // let oldest_message = latest_messages.last();
        // let statute_of_limitations = chrono::Utc::now()
        //     .checked_sub_signed(chrono::Duration::minutes(10))
        //     .context("Failed to subtract time")?;

        // if let Some(oldest_message) = oldest_message {
        //     if user_message_count - 10 > system_message_count && oldest_message.date_created < statute_of_limitations {
        //     let diff = statute_of_limitations.timestamp_millis() - oldest_message.date_created.timestamp_millis();
        //     let diff_minutes = diff / 1000 / 60;

        //     Err(anyhow!(format!(
        //         "You can't send a message until the system has responded to your last message. Please wait {} minutes and try again. Statute of limitations: {}",
        //         diff_minutes, statute_of_limitations
        //     )))?;
        // }
        // }

        // otherwise we can create a new message
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
        // invalidate_query!(&space, "messages.list");

        let reply_task = ReplyTaskInfo {
            message_id: id,
            message_text: message.text.clone(),
        };
        self.clone()
            .dispatcher
            .dispatch(&self, reply_task.clone().runnable())
            .await?;

        Ok(())
    }
}

// used to return to the frontend with uuid context
#[derive(Serialize, Deserialize, Debug, Type)]
pub struct SpaceWrapped {
    pub id: Uuid,
    pub meta: meta::Data,
}
