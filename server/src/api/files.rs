use custom_prisma::prisma::{file, task};
use rspc::alpha::AlphaRouter;
use serde::{Deserialize, Serialize};
use specta::Type;

use uuid::Uuid;

use crate::{api::CoreEvent, utils::u2b};

use super::{file_with_tasks, utils::space, Ctx, R};

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router()
        .procedure("list", {
            R.with2(space()).query(|(_ctx, space), _: ()| async move {
                let files = space
                    .db
                    .file()
                    .find_many(vec![file::space_id::equals(u2b(space.id))])
                    .include(file_with_tasks::include())
                    .exec()
                    .await?;

                // let files: Vec<FileWrapped> = files
                //     .into_iter()
                //     .map(|x| FileWrapped {
                //         id: Uuid::from_slice(&x.id).unwrap(),
                //         name: x.clone().name,
                //         file_with_tasks: x.clone().into(),
                //     })
                //     .collect();

                Ok(files)
            })
        })
        .procedure("updates", {
            R.with2(space()).subscription(|(ctx, _), _: ()| async move {
                let mut event_bus_rx = ctx.event_bus.0.subscribe();
                async_stream::stream! {
                    while let Ok(event) = event_bus_rx.recv().await {
                        match event {
                            CoreEvent::FileUpdate { files } => yield files,
                            _ => {}
                        }
                    }
                }
            })
        })
}

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct FileWrapped {
    pub id: Uuid,
    pub name: String,
    pub file_with_tasks: file_with_tasks::Data,
}
