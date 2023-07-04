use anyhow::{Context, Result};
use rspc::alpha::AlphaRouter;
use tracing::debug;

use super::{Ctx, R};
use uuid::Uuid;

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router().procedure("create", {
        R.mutation(|ctx, _: ()| async move {
            debug!("Creating user");

            let user_with_token = ctx.user_manager.create_detached().await?;
            // let uuid = Uuid::parse_str(&user_with_token.user.id_str);
            // if uuid.is_err() {
            //     return Err(anyhow::anyhow!("Invalid UUID"));
            // }

            // let user = ctx
            //     .user_manager
            //     .get_user((user_with_token.user.id_str))
            //     .await?;
            Ok(user_with_token)
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
