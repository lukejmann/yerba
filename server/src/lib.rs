#![warn(clippy::unwrap_used, clippy::panic)]

use crate::{
    api::{CoreEvent, Router},
    tasks::{upload_file::FileUploadTaskInfo, IntoTask},
};

use axum::body::Bytes;
use custom_prisma::prisma::{self, PrismaClient};
use space::SpaceManager;
use std::{
    env,
    path::{Path, PathBuf},
    sync::Arc,
};
use tasks::dispatcher::Dispatcher;
use tracing_appender::{
    non_blocking::{NonBlocking, WorkerGuard},
    rolling::{RollingFileAppender, Rotation},
};
use utils::load_and_migrate;
use uuid::Uuid;

use anyhow::{anyhow, Context, Result};
use tokio::{fs, io::AsyncWriteExt, sync::broadcast};
use tracing::{info, warn, Level};

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub mod api;
pub mod custom_uri;
pub mod utils;

pub(crate) mod space;
pub(crate) mod tasks;
pub(crate) mod user;

#[derive(Clone)]
pub struct NodeContext {
    pub event_bus_tx: broadcast::Sender<CoreEvent>,
    pub db: Arc<PrismaClient>,
    pub dispatcher: Arc<Dispatcher>,
}

pub struct Node {
    pub spaces_dir: PathBuf,
    pub space_manager: Arc<SpaceManager>,
    pub user_manager: Arc<user::UserManager>,

    event_bus: (broadcast::Sender<CoreEvent>, broadcast::Receiver<CoreEvent>),
    db: Arc<PrismaClient>,
    dispatcher: Arc<Dispatcher>,
}

pub async fn get_db() -> Arc<PrismaClient> {
    let db_addr = match env::var("DB_ADDR") {
        Ok(path) => path,
        Err(_e) => {
            panic!("'$DB_ADDR' is not set ({})", _e)
        }
    };
    let db = Arc::new(load_and_migrate(&db_addr).await.unwrap());
    db
}

pub async fn get_spaces_dir() -> PathBuf {
    let spaces_dir = match env::var("SPACES_DIR") {
        Ok(path) => Path::new(&path).to_path_buf(),
        Err(_e) => {
            panic!("'$SPACES_DIR' is not set ({})", _e)
        }
    };
    spaces_dir
}

impl Node {
    pub async fn new(spaces_dir: impl AsRef<Path>) -> Result<(Arc<Node>, Arc<Router>)> {
        let spaces_dir = spaces_dir.as_ref();

        let _ = fs::create_dir_all(&spaces_dir).await;

        let event_bus = broadcast::channel(1024);

        let db = get_db().await;
        let dispatcher = Dispatcher::new();

        let space_manager = SpaceManager::new(NodeContext {
            event_bus_tx: event_bus.0.clone(),
            db: db.clone(),
            dispatcher: dispatcher.clone(),
        })
        .await?;

        let user_manager = user::UserManager::new(NodeContext {
            event_bus_tx: event_bus.0.clone(),
            db: db.clone(),
            dispatcher: dispatcher.clone(),
        })
        .await?;

        let router = api::mount();
        let node = Node {
            spaces_dir: spaces_dir.to_path_buf(),

            space_manager,
            user_manager,

            event_bus,
            db,
            dispatcher,
        };

        info!("Yerb online.");
        Ok((Arc::new(node), router))
    }

    pub fn init_logger(data_dir: impl AsRef<Path>) {
        let collector = tracing_subscriber::fmt()
            // filter spans/events with level TRACE or higher.
            .with_max_level(Level::TRACE)
            // build but do not install the subscriber.
            .finish();

        tracing::collect::set_global_default(collector)
            .map_err(|err| {
                println!("Error initializing global logger: {:?}", err);
            })
            .ok();

        // guard
    }

    pub async fn handle_file_upload(
        &self,
        jwt: String,
        space_id: String,
        path: String,
        bytes: &Bytes,
    ) -> Result<()> {
        let space_id_uuid = Uuid::parse_str(&space_id)?;
        let user = self
            .user_manager
            .user_from_jwt(jwt)
            .await
            .with_context(|| "failed to parse jwt token")?;

        let space = self
            .space_manager
            .get_space(space_id_uuid)
            .await
            .with_context(|| "failed to get space")?;

        if space.owner_id != user.id {
            return Err(anyhow!("user is not owner of space"));
        }

        let space_base_path = get_spaces_dir().await;
        let space_path = space_base_path.join(space_id.to_string());
        let file_path = space_path.join(path.clone());

        let mut file = tokio::fs::File::create(file_path.clone()).await?;

        let res: Result<(), std::io::Error> = file.write_all(bytes).await;

        res.with_context(|| "failed to write file")?;

        // can hold off on perfect sync on uploads. just do pull-based in upload_file task

        Ok(())
    }

    pub async fn shutdown(&self) {
        info!("shutting down...");

        info!("shutdown complete");
    }
}
