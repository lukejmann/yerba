use rspc::{
    alpha::{
        unstable::{MwArgMapper, MwArgMapperMiddleware},
        MwV3,
    },
    ErrorCode,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

use crate::{api::Ctx, space::Space};

/// Can wrap a query argument to require it to contain a `space_id` and provide helpers for working with spaces.
#[derive(Clone, Serialize, Deserialize, Type)]
pub(crate) struct SpaceArgs<T> {
    jwt: String,
    space_id: Uuid,
    arg: T,
}

pub(crate) struct SpaceArgsLike;
impl MwArgMapper for SpaceArgsLike {
    type Input<T> = SpaceArgs<T> where T: Type + DeserializeOwned + 'static;
    type State = (String, Uuid);

    fn map<T: Serialize + DeserializeOwned + Type + 'static>(
        arg: Self::Input<T>,
    ) -> (T, Self::State) {
        (arg.arg, (arg.jwt, arg.space_id))
    }
}

pub(crate) fn space() -> impl MwV3<Ctx, NewCtx = (Ctx, Space)> {
    MwArgMapperMiddleware::<SpaceArgsLike>::new().mount(
        |mw, ctx: Ctx, (jwt, space_id)| async move {
            let user = ctx.user_manager.user_from_jwt(jwt).await.ok_or_else(|| {
                rspc::Error::new(
                    ErrorCode::BadRequest,
                    "You must specify a valid user to use this operation.".to_string(),
                )
            })?;
            let space = ctx.space_manager.get_space(space_id).await.ok_or_else(|| {
                rspc::Error::new(
                    ErrorCode::BadRequest,
                    "You must specify a valid space to use this operation.".to_string(),
                )
            })?;

            if space.owner_id != user.id {
                return Err(rspc::Error::new(
                    ErrorCode::BadRequest,
                    "Invalid space access permissions.".to_string(),
                ));
            }

            Ok(mw.next((ctx, space)))
        },
    )
}
