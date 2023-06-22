use anyhow::{Context, Result};
use rspc::alpha::AlphaRouter;
use serde::Deserialize;
use specta::Type;
use tracing::debug;
use uuid::Uuid;

use crate::{
    api::utils::user,
    utils::{b2u, u2b},
};
use custom_prisma::prisma::{account, user as db_user};
// use custom_prisma::prisma::account::user_id

use super::{Ctx, R};

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router()
        .procedure("create", {
            R.mutation(|ctx, _: ()| async move {
                debug!("Creating user");
                Ok(ctx.user_manager.create_detached().await?)
            })
        })
        .procedure("getAccount", {
            R.with2(user()).query(|(ctx, user), _: ()| async move {
                let account = user
                    .db
                    .account()
                    .find_unique(account::user_id::equals(u2b(user.id)))
                    .exec()
                    .await?;

                Ok(account)
            })
        })
        // To sign up, we take the detached user and attach it to an account.
        .procedure("signUp", {
            #[derive(Deserialize, Type)]
            pub struct AttachToAccountArgs {
                username: String,
                password: String,
            }
            R.with2(user())
                .mutation(|(ctx, user), args: AttachToAccountArgs| async move {
                    let account_id = Uuid::new_v4();
                    let new_account = user
                        .db
                        .account()
                        .create(
                            u2b(account_id),
                            args.username,
                            args.password,
                            db_user::id::equals(u2b(user.id)),
                            vec![],
                        )
                        .exec()
                        .await?;

                    let new_token = ctx.user_manager.generate_jwt(user.id).await?;

                    Ok(new_token)
                })
        })
        // To log in, we verify the submitted credentials and generate a new token.
        .procedure("logIn", {
            #[derive(Deserialize, Type)]
            pub struct LogInArgs {
                username: String,
                password: String,
            }
            // .mutation(|ctx, _: ()| async move {
            R.mutation(|(ctx), args: LogInArgs| async move {
                let account = ctx
                    .db
                    .account()
                    .find_unique(account::username::equals(args.username))
                    .exec()
                    .await?;

                let account = account.context("Account not found")?;

                if account.password == args.password {
                    let new_token = ctx.user_manager.generate_jwt(b2u(&account.user_id)).await?;
                    Ok(new_token)
                } else {
                    Err(rspc::Error::new(
                        rspc::ErrorCode::Unauthorized,
                        "invalid credentials".into(),
                    ))
                }
            })
        })
}

// pub(crate) fn mount() -> AlphaRouter<Ctx> {
//     R.router().procedure("create", {
//         R.mutation(|ctx, _: ()| async move {
//         debug!("Creating user");
//         match ctx.user_manager.create_detached().await {
//             Ok(value) => Ok(value),
//             Err(anyhow_err) => {
//                 // Log the error, etc.
//                 Err(rspc::Error::new(
//                     rspc::ErrorCode::InternalServerError,
//                     "internal server error 2".into(),
//                 ))
//             }
//         }
//     })
// }
