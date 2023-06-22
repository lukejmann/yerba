use crate::api::utils::{space, user};


use custom_prisma::prisma::meta::{self, SetParam};
use rspc::alpha::AlphaRouter;
use serde::Deserialize;
use specta::Type;
use tracing::debug;

use super::{Ctx, R};

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router()
        .procedure("list", {
            R.with2(user()).query(|(ctx, user), _: ()| async move {
                ctx.space_manager.get_all_spaces_for_user(user).await
            })
        })
        .procedure("create", {
            #[derive(Deserialize, Type)]
            pub struct CreateSpaceArgs {
                name: String,
            }
            R.with2(user())
                .mutation(|(ctx, user), args: CreateSpaceArgs| async move {
                    debug!("Creating space");
                    let new_space = ctx
                        .space_manager
                        .create_as_user(user, args.name, "A new space".to_string())
                        .await?;

                    Ok(new_space)
                })
        })
        .procedure("edit", {
            #[derive(Type, Deserialize)]
            pub struct EditSpaceArgs {
                pub name: Option<String>,
                pub description: Option<String>,
            }

            R.with2(space())
                .mutation(|(ctx, space), args: EditSpaceArgs| async move {
                    // debug!("Editing space");
                    let mut updates: Vec<SetParam> = vec![];
                    if let Some(name) = args.name {
                        // debug!("Updating name to {}", name);
                        if name.len() > 3 {
                            updates.push(meta::name::set(name));
                        }
                    }
                    if let Some(description) = args.description {
                        if description.len() > 3 {
                            // debug!("Updating description to {}", description);
                            updates.push(meta::description::set(description));
                        }
                    }

                    let updated_space = space
                        .db
                        .meta()
                        .update(meta::id::equals(space.meta.id), updates)
                        .exec()
                        .await?;

                    ctx.space_manager.sync_space_from_db(space.id).await?;

                    Ok(updated_space)
                })
        })
        .procedure("delete", {
            #[derive(Deserialize, Type)]
            pub struct DeleteSpaceArgs {
                id: uuid::Uuid,
            }
            R.with2(user())
                .mutation(|(ctx, _user), args: DeleteSpaceArgs| async move {
                    debug!("Deleting space");
                    let _r = ctx.space_manager.delete_space(args.id).await?;
                    debug!("Deleted space");
                    // .with_context(|| format!("Failed to delete space with id {}", args.id))
                    // .map_err(|e| e.to_string())?;

                    Ok(())
                })
        })
}
