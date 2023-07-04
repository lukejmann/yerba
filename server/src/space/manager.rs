use crate::{
    get_demo_dir, get_spaces_dir, invalidate_query,
    space::SpaceWrapped,
    tasks::{dispatcher::Dispatcher, upload_file::SUPPORTED_EXTENSIONS},
    user::User,
    utils::{u2b, u2s},
    NodeContext,
};
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, BufReader, SeekFrom},
};

use std::sync::Arc;

use anyhow::{Context, Result};
use custom_prisma::prisma::{
    file::{self, name},
    meta, space as db_space, user,
};
use fs_extra::dir::CopyOptions;

use tokio::sync::RwLock;
use tracing::debug;
use uuid::Uuid;

use super::Space;

pub struct SpaceManager {
    spaces: RwLock<Vec<Space>>,
    node_context: NodeContext,
}

impl SpaceManager {
    pub(crate) async fn new(node_context: NodeContext) -> Result<Arc<Self>> {
        let mut spaces = Vec::new();

        let all_spaces = node_context
            .db
            .space()
            .find_many(vec![])
            .include(db_space::include!({ meta owner}))
            .exec()
            .await?;

        let _node_id: Uuid = Uuid::new_v4();

        for space in all_spaces {
            // Assume Dispatcher doesn't need to hold onto Arc<Space>

            spaces.push(Space {
                id: Uuid::from_slice(&space.id).unwrap(),
                owner_id: Uuid::from_slice(&space.owner.id).unwrap(),
                meta: space.meta,
                db: node_context.db.clone(),
                dispatcher: node_context.dispatcher.clone(),
                node_context: node_context.clone(),
            });
        }

        let this = Arc::new(Self {
            spaces: RwLock::new(spaces),
            node_context,
        });

        debug!("SpaceManager initialized");

        Ok(this)
    }

    pub(crate) async fn sync_space_from_db(&self, id: Uuid) -> Result<()> {
        let old_dispatcher: Arc<Dispatcher> = {
            let spaces = self.spaces.read().await;
            let space = spaces
                .iter()
                .find(|space| space.id == id)
                .context("Space not found")?;

            space.dispatcher.clone()
        };
        let space = self
            .node_context
            .db
            .space()
            .find_unique(db_space::id::equals(id.as_bytes().to_vec()))
            .include(db_space::include!({ meta owner}))
            .exec()
            .await
            .with_context(|| format!("Failed to find space with id {:?}", id))?
            .context("Space not found")?;

        let mut spaces = self.spaces.write().await;

        let space = Space {
            id: Uuid::from_slice(&space.id).unwrap(),
            owner_id: Uuid::from_slice(&space.owner.id).unwrap(),
            meta: space.meta,
            db: self.node_context.db.clone(),
            dispatcher: old_dispatcher,
            node_context: self.node_context.clone(),
        };

        spaces.retain(|s| s.id != id);
        spaces.push(space);

        Ok(())
    }

    pub(crate) async fn create_as_user(
        &self,
        user: User,
        name: String,
        description: String,
    ) -> Result<Space> {
        let space_id: Uuid = Uuid::new_v4();
        let meta_id = Uuid::new_v4();

        let space_id_vec: Vec<u8> = u2b(space_id);
        let user_id_vec: Vec<u8> = u2b(user.id);
        let meta_id_vec: Vec<u8> = u2b(meta_id);

        let new_meta = self
            .node_context
            .db
            .meta()
            .create(meta_id_vec.clone(), u2s(meta_id), name, description, vec![])
            .exec()
            .await?;

        let _new_space: db_space::Data = self
            .node_context
            .db
            .space()
            .create(
                space_id_vec.clone(),
                u2s(space_id),
                meta::id::equals(meta_id_vec),
                user::id::equals(user_id_vec),
                vec![],
            )
            .exec()
            .await?;

        let new_space = Space {
            id: space_id,
            owner_id: user.id,
            meta: new_meta,
            db: self.node_context.db.clone(),
            dispatcher: self.node_context.dispatcher.clone(),
            node_context: self.node_context.clone(),
        };

        let space_base_path = get_spaces_dir().await;
        let space_path = space_base_path.join(space_id.to_string());

        if !space_path.exists() {
            fs::create_dir_all(space_path.as_path()).await?;
        }

        self.spaces.write().await.push(new_space.clone());

        invalidate_query!(new_space, "spaces.list");

        Ok(new_space)
    }

    // here we create the file by calling create_as_user with name "CS 229" and description "Demo space for CS 229"
    // then, we copy all files from get_demo_dir() and add them all as files to the space (except for the vector_db directory)
    // them, we call space.receieve_msg_from_user()
    pub async fn create_demo_for_user(&self, user: User) -> Result<Space> {
        debug!("Creating demo space for user {:?}", user);
        let name = "CS 229".to_string();
        let description = "Demo space for CS 229".to_string();

        let space = self.create_as_user(user, name, description).await?;

        let demo_dir = get_demo_dir().await;
        // return if demo_dir doesn't exist
        if !demo_dir.is_some() {
            return Ok(space);
        }
        let demo_dir = demo_dir.unwrap();

        let space_base_path = get_spaces_dir().await;
        let space_path = space_base_path.join(space.id.to_string());

        let mut read_dir = fs::read_dir(demo_dir.clone()).await?;
        while let Some(entry) = read_dir.next_entry().await? {
            let path = entry.path();
            let file_name = path.file_name().unwrap().to_str().unwrap().to_string();

            if file_name != "vector_db" {
                let demo_file = fs::File::open(path.clone()).await?;
                let mut demo_file = BufReader::new(demo_file);
                let mut demo_file_contents = vec![];
                demo_file.read_to_end(&mut demo_file_contents).await?;

                let new_file_id = Uuid::new_v4();
                let new_file_path = space_path.join(file_name.clone());
                debug!("Creating file {:?}", new_file_path.clone());

                // let mut name = info.path.split('/').last().unwrap();
                let extension = file_name.split('.').last().unwrap();
                let name = file_name.split('.').next().unwrap();

                let mut new_file = fs::File::create(new_file_path.clone()).await?;
                new_file.write_all(&demo_file_contents).await?;

                // TODO: refactor file.learned. (see tasks/mod.rs)
                // TODO: redundant code with upload_file/mod.rs

                let supported = SUPPORTED_EXTENSIONS
                    .iter()
                    .any(|ext| ext.to_string() == extension);

                let file_data = space
                    .db
                    .file()
                    .create(
                        u2b(new_file_id),
                        u2s(new_file_id),
                        path.to_str().unwrap().to_string(),
                        name.to_string(),
                        extension.to_string(),
                        db_space::id::equals(u2b(space.clone().id)),
                        vec![file::learned::set(true), file::supported::set(supported)],
                    )
                    .exec()
                    .await?;

                debug!("Created file {:?}", file_data);

                if !new_file_path.exists() {
                    fs::create_dir_all(new_file_path.as_path()).await?;
                }

                // files.push(file_data);
            }
        }

        // now we copy the vector_db directory (recursively) to the space directory
        let new_vector_db_path = space_path.join("vector_db");
        let demo_vector_db_path = demo_dir.join("vector_db");
        debug!(
            "Creating vector_db {:?} from {:?}",
            new_vector_db_path.clone(),
            demo_vector_db_path.clone()
        );

        fs_extra::dir::copy(
            demo_vector_db_path.clone(),
            space_path.clone(),
            &fs_extra::dir::CopyOptions::new(),
        )?;

        space
            .receieve_msg_from_user("Explain Jensen's inequality step by step".to_string())
            .await?;

        invalidate_query!(space, "files.list");
        Ok(space)
    }

    pub async fn delete_space(&self, space_id: Uuid) -> Result<()> {
        let mut spaces = self.spaces.write().await;
        let mut spaces2 = spaces.clone();
        let space = spaces2
            .iter_mut()
            .find(|space| space.id == space_id)
            .context("Space not found")?;

        let space_base_path = get_spaces_dir().await;

        let space_path = space_base_path.join(space_id.to_string());

        if space_path.exists() {
            fs::remove_dir_all(space_path.as_path()).await?;
        }

        let _r = self
            .node_context
            .db
            .space()
            .delete(db_space::id::equals(u2b(space_id)))
            .exec()
            .await
            .with_context(|| format!("Failed to delete space with id {:?}", space_id))?;

        spaces.retain(|space| space.id != space_id);

        invalidate_query!(space, "spaces.list");

        Ok(())
    }

    pub async fn get_all_spaces_for_user(&self, user: User) -> Vec<SpaceWrapped> {
        let _user_id_vec: Vec<u8> = user.id.as_bytes().to_vec();

        let spaces = self.spaces.read().await;

        let mut result = vec![];

        for space in spaces.iter() {
            if space.owner_id == user.id {
                result.push(SpaceWrapped {
                    id: space.id,
                    meta: space.meta.clone(),
                });
            }
        }

        result
    }

    pub async fn get_space(&self, space_id: Uuid) -> Option<Space> {
        self.spaces
            .read()
            .await
            .iter()
            .find(|lib| lib.id == space_id)
            .map(Clone::clone)
    }
}
