use rspc::{
    alpha::{
        unstable::{MwArgMapper, MwArgMapperMiddleware},
        MwV3,
    },
    ErrorCode,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use specta::Type;

use crate::{api::Ctx, user::User};

/// Can wrap a query argument to require it to contain a `user_id` and provide helpers for working with users.
#[derive(Clone, Serialize, Deserialize, Type)]
pub(crate) struct UserArgs<T> {
    jwt_token: String,
    arg: T,
}

pub(crate) struct UserArgsLike;
impl MwArgMapper for UserArgsLike {
    type Input<T> = UserArgs<T> where T: Type + DeserializeOwned + 'static;
    type State = String;

    fn map<T: Serialize + DeserializeOwned + Type + 'static>(
        arg: Self::Input<T>,
    ) -> (T, Self::State) {
        (arg.arg, arg.jwt_token)
    }
}

pub(crate) fn user() -> impl MwV3<Ctx, NewCtx = (Ctx, User)> {
    MwArgMapperMiddleware::<UserArgsLike>::new().mount(|mw, ctx: Ctx, jwt_token| async move {
        let user = ctx
            .user_manager
            .user_from_jwt_token(jwt_token)
            .await
            .ok_or_else(|| {
                rspc::Error::new(
                    ErrorCode::BadRequest,
                    "You must specify a valid user to use this operation.".to_string(),
                )
            })?;

        Ok(mw.next((ctx, user)))
    })
}
