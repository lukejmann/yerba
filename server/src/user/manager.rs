use crate::NodeContext;

use jsonwebtoken::{Algorithm, TokenData};

use serde::{Deserialize, Serialize};

use std::sync::Arc;

use specta::Type;

use anyhow::{Context, Result};
use custom_prisma::prisma::user;
use tokio::sync::RwLock;
use tracing::debug;
use uuid::Uuid;

use super::User;

// TODO: actual security
pub const SECRET: &[u8] = b"secret";

#[derive(Debug, Deserialize, Serialize)]
struct Claims {
    sub: Uuid,
    exp: usize,
}

#[derive(Serialize, Deserialize, Type, Debug)]
pub struct UserWithToken {
    pub user: user::Data,
    pub token: String,
}

// TODO: don't want all of these in mem
/// UserManager is a singleton that manages all users for a node.
pub struct UserManager {
    /// users holds the list of users which are currently loaded into the node.
    users: RwLock<Vec<User>>,
    node_context: NodeContext,
    // db: Arc<PrismaClient>,
}

impl UserManager {
    pub(crate) async fn new(node_context: NodeContext) -> Result<Arc<Self>> {
        let mut users = Vec::new();

        let all_users = node_context
            .db
            .user()
            .find_many(vec![])
            .include(user::include!({ jwts }))
            .exec()
            .await?;

        for user in all_users {
            let jwts = user.jwts.into_iter().map(|jwt| jwt.token).collect();
            users.push(User {
                id: Uuid::from_slice(&user.id).unwrap(),
                jwts,
                db: node_context.db.clone(),
                node_context: node_context.clone(),
            });
        }

        let this = Arc::new(Self {
            users: RwLock::new(users),
            node_context,
        });

        debug!("UserManager initialized");

        Ok(this)
    }

    pub(crate) async fn sync_user_from_db(&self, id: Uuid) -> Result<()> {
        let user = self
            .node_context
            .db
            .user()
            .find_unique(user::id::equals(id.as_bytes().to_vec()))
            .include(user::include!({ jwts }))
            .exec()
            .await?
            .with_context(|| format!("User with id {} not found in sync", id))?;

        let jwts = user.jwts.into_iter().map(|jwt| jwt.token).collect();

        let mut users = self.users.write().await;
        let user_existing = users.iter_mut().find(|u| u.id == id);

        // if the user already exists, update it
        if let Some(user_existing) = user_existing {
            user_existing.jwts = jwts;
            return Ok(());
        }

        // otherwise, create a new user
        let new_user = User {
            id,
            jwts,
            db: self.node_context.db.clone(),
            node_context: self.node_context.clone(),
        };

        users.push(new_user);

        Ok(())
    }

    /// create creates a new user with the given config and mounts it into the running [UserManager].
    pub(crate) async fn create_detached(&self) -> Result<UserWithToken> {
        let user_id = Uuid::new_v4();

        // println!("encoding id: {:?}", id);

        let expires: chrono::DateTime<chrono::Utc> =
            chrono::Utc::now() + chrono::Duration::days(30);

        let claims = Claims {
            sub: user_id, // or whatever the field is named in your payload
            // set here the other fields
            exp: expires.timestamp() as usize,
        };

        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(Algorithm::HS256),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(SECRET),
        )
        .unwrap();

        let new_user = self.create_with_uuid(user_id).await?;

        let new_jwt = self
            .node_context
            .db
            .jwt()
            .create(token, user::id::equals(new_user.clone().id), vec![])
            .exec()
            .await?;

        self.sync_user_from_db(user_id).await?;

        debug!("Created user: {:?}", new_user);

        Ok(UserWithToken {
            user: new_user,
            token: new_jwt.token,
        })
    }

    // generates a new jwt for the given user and appends it to the user's jwts.
    pub(crate) async fn generate_jwt(&self, user_id: Uuid) -> Result<String> {
        let expires: chrono::DateTime<chrono::Utc> =
            chrono::Utc::now() + chrono::Duration::days(30);

        let claims = Claims {
            sub: user_id, // or whatever the field is named in your payload
            // set here the other fields
            exp: expires.timestamp() as usize,
        };

        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(Algorithm::HS256),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(SECRET),
        )
        .unwrap();

        let new_jwt = self
            .node_context
            .db
            .jwt()
            .create(token, user::id::equals(user_id.as_bytes().to_vec()), vec![])
            .exec()
            .await?;

        Ok(new_jwt.token)
    }

    pub(crate) async fn create_with_uuid(&self, id: Uuid) -> Result<user::Data> {
        let id_vec: Vec<u8> = id.as_bytes().to_vec();

        let new_user: user::Data = self
            .node_context
            .db
            .user()
            .create(id_vec, vec![])
            .exec()
            .await?;

        Ok(new_user)
    }

    // get_ctx will return the user context for the given user id.
    pub async fn get_user(&self, user_id: Uuid) -> Option<User> {
        self.users
            .read()
            .await
            .iter()
            .find(|lib| lib.id == user_id)
            .map(Clone::clone)
    }

    pub async fn user_from_jwt(&self, token: String) -> Option<User> {
        let decoded: Result<TokenData<Claims>, jsonwebtoken::errors::Error> = jsonwebtoken::decode(
            &token,
            &jsonwebtoken::DecodingKey::from_secret(SECRET),
            &jsonwebtoken::Validation::new(Algorithm::HS256),
        );

        // if error, we log it and return None
        if let Err(err) = decoded {
            println!("error decoding jwt: {:?} {:?}", err, token);
            return None;
        }

        let decoded = decoded.ok()?;

        let decoded = decoded.claims.sub;

        let user = self
            .users
            .read()
            .await
            .iter()
            .find(|u| u.id == decoded)
            .map(Clone::clone);

        user
    }
}
