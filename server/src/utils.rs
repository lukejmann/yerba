use std::sync::Arc;

use super::Node;
use custom_prisma::prisma::{self, PrismaClient};
use prisma_client_rust::{
    migrations::DbPushError, prisma_errors::schema_engine::ApplyMigrationError,
};
use tokio::signal;
use uuid::Uuid;

/// shutdown_signal will inform axum to gracefully shutdown when the process is asked to shutdown.
pub async fn axum_shutdown_signal(node: Arc<Node>) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    tokio::select! {
        _ = ctrl_c => {},
    }

    node.shutdown().await;
}

// Uuid to bytes (used for most database ids)
pub fn u2b(uuid: Uuid) -> Vec<u8> {
    uuid.as_bytes().to_vec()
}

/// load_and_migrate will load the database from the given path and migrate it to the latest version of the schema.
pub async fn load_and_migrate(db_url: &str) -> Result<PrismaClient, rspc::Error> {
    let client = prisma::new_client_with_url(db_url)
        .await
        .map_err(|e| anyhow::anyhow!("failed to create prisma client: {}", e))?;

    #[cfg(debug_assertions)]
    {
        let mut builder = client._db_push();

        let res = builder.await;
    }

    Ok(client)
}