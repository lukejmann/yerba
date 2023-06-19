use crate::{
    api::CoreEvent,
    tasks::{upload_file::FileUploadTaskInfo, IntoTask},
    utils::u2b,
};
pub use anyhow::{Context, Result};

use custom_prisma::prisma::{file, space, task};
use rspc::alpha::AlphaRouter;
use tracing::{debug, instrument::WithCollector};
use uuid::Uuid;

use super::{utils::space, Ctx, R};

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router()
        .procedure("list", {
            R.with2(space()).query(|(_ctx, space), _: ()| async move {
                let active_task_hashes = space.dispatcher.list().await?;
                // should be in for of task::hash::equals(x)
                let where_clause = active_task_hashes
                    .iter()
                    .map(|x| task::id::equals(u2b(*x)))
                    .collect();
                let active = space.db.task().find_many(where_clause).exec().await?;
                Ok(active)
            })
        })
        .procedure("uploadFile", {
            R.with2(space())
                .mutation(|(_, space), args: FileUploadTaskInfo| async move {
                    debug!("Beginning upload");
                    let upload_task_id = space
                        .clone()
                        .dispatcher
                        .dispatch(&space, args.clone().runnable())
                        .await?;
                    Ok(())
                })
        })
        // .with_collector(collector)
        .procedure("updates", {
            R.with2(space()).subscription(|(ctx, _), _: ()| async move {
                let mut event_bus_rx = ctx.event_bus.0.subscribe();
                async_stream::stream! {
                    while let Ok(event) = event_bus_rx.recv().await {
                        match event {
                            CoreEvent::TaskUpdate { tasks } => yield tasks,
                            _ => {}
                        }
                    }
                }
            })
        })
}
