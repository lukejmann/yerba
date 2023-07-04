use crate::{api::CoreEvent, NodeContext};

use std::{
    fmt::{Debug, Formatter},
    sync::Arc,
};

use custom_prisma::prisma::PrismaClient;
use tracing::warn;
use uuid::Uuid;

/// UserContext holds context for a space which can be passed around the application.
#[derive(Clone)]
pub struct User {
    pub id: Uuid,

    pub jwts: Vec<String>,
    pub db: Arc<PrismaClient>,
    pub(super) node_context: NodeContext,
}

impl Debug for User {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UserContext")
            .field("id", &self.id)
            .field("db", &self.db)
            .finish()
    }
}
