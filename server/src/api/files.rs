use custom_prisma::prisma::file;
use rspc::alpha::AlphaRouter;
use serde::{Deserialize, Serialize};
use specta::Type;

use uuid::Uuid;

use crate::utils::u2b;

use super::{utils::space, Ctx, R};

file::include!(file_with_tasks { tasks : select { id task_type status } });

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router().procedure("list", {
        R.with2(space()).query(|(_ctx, space), _: ()| async move {
            let files = space
                .db
                .file()
                .find_many(vec![file::space_id::equals(u2b(space.id))])
                .include(file_with_tasks::include())
                .exec()
                .await?;

            let files: Vec<FileWrapped> = files
                .into_iter()
                .map(|x| FileWrapped {
                    id: Uuid::from_slice(&x.id).unwrap(),
                    name: x.clone().name,
                    file_with_tasks: x.clone().into(),
                })
                .collect();

            Ok(files)
        })
    })
}

#[derive(Serialize, Deserialize, Debug, Type)]
pub struct FileWrapped {
    pub id: Uuid,
    pub name: String,
    pub file_with_tasks: file_with_tasks::Data,
}
