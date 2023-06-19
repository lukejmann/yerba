use crate::{api::CoreEvent, tasks::dispatcher::Dispatcher, NodeContext};
use serde::{Deserialize, Serialize};
use specta::Type;

use std::{
    fmt::{Debug, Formatter},
    sync::Arc,
};

use custom_prisma::prisma::{meta, PrismaClient};

use tracing::warn;
use uuid::Uuid;

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
}

// used to return to the frontend with uuid context
#[derive(Serialize, Deserialize, Debug, Type)]
pub struct SpaceWrapped {
    pub id: Uuid,
    pub meta: meta::Data,
}
