use std::f32::consts::E;
use std::ops::Sub;

use crate::{
    api::CoreEvent,
    tasks::{
        learn_file::{LearnFileTask, LearnFileTaskInfo},
        upload_file::FileUploadTaskInfo,
        IntoTask,
    },
    utils::u2b,
};
use anyhow::{anyhow, bail, Context, Error, Result};
use custom_prisma::prisma::message;
use custom_prisma::prisma::{file, space as db_space, task};
use prisma_client_rust::schema::constants::ordering::SORT_ORDER;
use rspc::alpha::AlphaRouter;
use serde::{Deserialize, Serialize};
use specta::Type;

use tracing::debug;
use uuid::Uuid;

use crate::invalidate_query;
use crate::tasks::reply::ReplyTaskInfo;
use crate::utils::u2s;

use super::{message_with_tasks_and_peer, utils::space, Ctx, R};

#[derive(Serialize, Type, Debug)]
struct MessagesWrapped {
    cursor: Option<Vec<u8>>,
    messages: Vec<message_with_tasks_and_peer::Data>,
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
                    let latest_messages = space
                        .db
                        .message()
                        .find_many(vec![message::space_id::equals(u2b(space.id))])
                        .order_by(message::date_created::order(
                            custom_prisma::prisma::SortOrder::Desc,
                        ))
                        .take(100)
                        .exec()
                        .await?;

                    // if there are 10 more messages with msg.user_message == true than msg.user_message == false, we can't create a new message until the system has responded to the user
                    let mut user_message_count = 0;
                    let mut system_message_count = 0;
                    // let oldest:
                    for message in latest_messages.clone() {
                        if message.is_user_message {
                            user_message_count += 1;
                        } else {
                            system_message_count += 1;
                        }
                    }

                    let  oldest_message = latest_messages.last();
                    let statute_of_limitations = chrono::Utc::now()
                        .checked_sub_signed(chrono::Duration::minutes(10))
                        .context("Failed to subtract time")?;


                    if let Some(oldest_message) = oldest_message {
                        if user_message_count - 10 > system_message_count && oldest_message.date_created < statute_of_limitations {
                        let diff = statute_of_limitations.timestamp_millis() - oldest_message.date_created.timestamp_millis();
                        let diff_minutes = diff / 1000 / 60;

                        Err(anyhow!(format!(
                            "You can't send a message until the system has responded to your last message. Please wait {} minutes and try again. Statute of limitations: {}",
                            diff_minutes, statute_of_limitations
                        )))?;
                    }
                    }

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
                        .include(message_with_tasks_and_peer::include())
                        .exec()
                        .await?;

                    debug!("Created message {:?}", message);
                    // invalidate_query!(&space, "messages.list");

                    let reply_task = ReplyTaskInfo{
                        message_id: id
                    };
                    let learn_taskId = space
                    .clone()
                    .dispatcher
                    .dispatch(&space, reply_task.clone().runnable())
                    .await?;

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
                        .include(message_with_tasks_and_peer::include())
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
