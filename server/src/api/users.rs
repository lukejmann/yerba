use rspc::alpha::AlphaRouter;
use tracing::debug;

use super::{Ctx, R};

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router().procedure("create", {
        R.mutation(|ctx, _: ()| async move {
            debug!("Creating user");
            Ok(ctx.user_manager.create_detached().await?)
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
