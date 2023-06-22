use custom_prisma::prisma::{file, task};
use rspc::{alpha::Rspc, Config};
use serde::Serialize;
use specta::Type;
use std::sync::Arc;

use crate::Node;
use utils::{InvalidRequests, InvalidateOperationEvent};

#[allow(non_upper_case_globals)]
pub(self) const R: Rspc<Ctx> = Rspc::new();

pub type Ctx = Arc<Node>;
pub type Router = rspc::Router<Ctx>;

file::include!(file_with_tasks { tasks : select { id id_str task_type status } });
task::include!(task_with_file { file });

#[derive(Debug, Clone, Serialize, Type)]
pub enum CoreEvent {
    TaskUpdate { tasks: Vec<task_with_file::Data> },
    FileUpdate { files: Vec<file_with_tasks::Data> },
    InvalidateOperation(InvalidateOperationEvent),
}

mod files;
mod spaces;
mod tasks;
mod users;

pub mod utils;

pub(crate) fn mount() -> Arc<Router> {
    let r = R
        .router()
        .merge("users.", users::mount())
        .merge("spaces.", spaces::mount())
        .merge("tasks.", tasks::mount())
        .merge("files.", files::mount())
        .merge("invalidation.", utils::mount_invalidate())
        .build(
            #[allow(clippy::let_and_return)]
            {
                let config = Config::new().set_ts_bindings_header("/* eslint-disable */");

                #[cfg(all(debug_assertions, not(feature = "mobile")))]
                let config = config.export_ts_bindings(
                    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("../app/src/rspc/core.ts"),
                );

                config
            },
        )
        .arced();
    InvalidRequests::validate(r.clone());

    r
}

#[cfg(test)]
mod tests {

    #[test]
    fn gen_rspc_bindings() {
        super::mount();
    }
}
