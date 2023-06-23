use std::f32::consts::E;

use anyhow::{anyhow, bail, Error, Result};
use custom_prisma::prisma::message;
use custom_prisma::prisma::{file, space as db_space, task};
use prisma_client_rust::schema::constants::ordering::SORT_ORDER;
use rspc::alpha::AlphaRouter;
use serde::{Deserialize, Serialize};
use specta::Type;

use tracing::debug;
use uuid::Uuid;

use crate::invalidate_query;
use crate::{
    api::CoreEvent,
    utils::{u2b, u2s},
};

use super::{message_with_tasks, utils::space, Ctx, R};

#[derive(Serialize, Type, Debug)]
struct MessagesWrapped {
    cursor: Option<Vec<u8>>,
    messages: Vec<message_with_tasks::Data>,
}

pub(crate) fn mount() -> AlphaRouter<Ctx> {
    R.router()
        .procedure("send", {
            #[derive(Deserialize, Type)]
            pub struct MessageSendArgs {
                text: String,
            }
            R.with2(space())
                .mutation(|(ctx, space), args: MessageSendArgs| async move {
                    debug!("Received message send request");
                    // find latest message in db
                    let latest_message = space
                        .db
                        .message()
                        .find_many(vec![message::space_id::equals(u2b(space.id))])
                        .order_by(message::date_created::order(
                            custom_prisma::prisma::SortOrder::Desc,
                        ))
                        .take(1)
                        .exec()
                        .await?;

                    // if latest message exists and msg.user_message is true, return error
                    // if let Some(latest_message) = latest_message.first() {
                    //     if latest_message.user_message {
                    //         Err(anyhow!("Waiting on response"))?;
                    //     }
                    // }

                    // otherwise we can create a new message
                    let id = Uuid::new_v4();

                    let message = space
                        .db
                        .message()
                        .create(
                            u2b(id),
                            u2s(id),
                            args.text,
                            db_space::id::equals(u2b(space.clone().id)),
                            vec![],
                        )
                        .include(message_with_tasks::include())
                        .exec()
                        .await?;

                    debug!("Created message {:?}", message);
                    invalidate_query!(&space, "messages.list");

                    Ok(message)
                })
        })
        .procedure("list", {
            #[derive(Deserialize, Type)]
            pub struct MessageListArgs {
                #[specta(optional)]
                take: Option<i32>,
                #[specta(optional)]
                cursor: Option<Vec<u8>>,
            }
            R.with2(space())
                .query(|(_ctx, space), args: MessageListArgs| async move {
                    let take = args.take.unwrap_or(100);

                    let mut query = space
                        .db
                        .message()
                        .find_many(vec![message::space_id::equals(u2b(space.id))])
                        .order_by(message::date_created::order(
                            custom_prisma::prisma::SortOrder::Desc,
                        ));
                    if let Some(cursor) = args.cursor {
                        query = query.cursor(message::id::equals(cursor));
                    }
                    let messages = query
                        .take(take as i64 + 1)
                        .include(message_with_tasks::include())
                        .exec()
                        .await?;

                    // .cursor(args.cursor)
                    // .take(args.take)
                    // .exec()
                    // .await?;

                    Ok(MessagesWrapped {
                        cursor: messages.last().map(|x| x.id.clone()),
                        messages: messages.into_iter().take(take as usize).collect(),
                    })
                })
        })
        .procedure("updates", {
            R.with2(space()).subscription(|(ctx, _), _: ()| async move {
                let mut event_bus_rx = ctx.event_bus.0.subscribe();
                async_stream::stream! {
                    while let Ok(event) = event_bus_rx.recv().await {
                        match event {
                            CoreEvent::MessageUpdate { messages } => yield messages,
                            _ => {}
                        }
                    }
                }
            })
        })
}
