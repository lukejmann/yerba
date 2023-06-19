use crate::{
    get_spaces_dir, invalidate_query, space::SpaceWrapped, tasks::dispatcher::Dispatcher,
    user::User, utils::u2b, NodeContext,
};

use std::sync::Arc;

use anyhow::{Context, Result};
use custom_prisma::prisma::{meta, space, user};

use tokio::{fs, sync::RwLock};
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
            .include(space::include!({ meta owner}))
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
            .find_unique(space::id::equals(id.as_bytes().to_vec()))
            .include(space::include!({ meta owner}))
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
    ) -> Result<SpaceWrapped> {
        let space_id: Uuid = Uuid::new_v4();
        let meta_id = Uuid::new_v4();

        let space_id_vec: Vec<u8> = u2b(space_id);
        let user_id_vec: Vec<u8> = u2b(user.id);
        let meta_id_vec: Vec<u8> = u2b(meta_id);

        let new_meta = self
            .node_context
            .db
            .meta()
            .create(meta_id_vec.clone(), name, description, vec![])
            .exec()
            .await?;

        let _new_space: space::Data = self
            .node_context
            .db
            .space()
            .create(
                space_id_vec.clone(),
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

        Ok(SpaceWrapped {
            id: new_space.id,
            meta: new_space.meta,
        })
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
            .delete(space::id::equals(u2b(space_id)))
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
