use crate::{space::Space, utils::u2b};
use std::{
    collections::{hash_map::DefaultHasher, VecDeque},
    hash::{Hash, Hasher},
    sync::Arc,
};

use custom_prisma::prisma::{space as db_space, task};
use serde::{de::DeserializeOwned, Serialize};

use tracing::debug;
use uuid::Uuid;

use anyhow::{Context, Result};

use self::dispatcher::Dispatcher;

pub mod dispatcher;
pub mod learn_file;
pub mod upload_file;

pub trait TaskInfo: Serialize + DeserializeOwned + Send + Sync + Hash {
    type Task: TaskExec;

    fn hash(&self) -> u64 {
        let mut s = DefaultHasher::new();
        <Self::Task as TaskExec>::TYPE.hash(&mut s);
        <Self as Hash>::hash(self, &mut s);
        s.finish()
    }
}

#[async_trait::async_trait]
pub trait TaskExec: Send + Sync + Sized {
    type Info: TaskInfo<Task = Self>;
    type Data: Serialize + DeserializeOwned + Send + Sync;
    const TYPE: &'static str;

    fn new() -> Self;

    async fn setup(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()>;

    async fn run(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()>;

    async fn finish(
        &self,
        space: &Space,
        task_id: Uuid,
        task_info: &mut TaskState<Self>,
    ) -> Result<()>;
}

// enum TaskCommand {
//     CompletedExternally,
//     Shutdown,
// }

#[async_trait::async_trait]
pub trait DTask: Send + Sync {
    fn id(&self) -> Uuid;
    fn parent_id(&self) -> Option<Uuid>;
    fn space_id(&self) -> Option<Uuid>;
    fn file_id(&self) -> Option<Uuid>;
    fn task_type(&self) -> &'static str;
    async fn setup(&mut self, space: &Space, dispatcher: Arc<Dispatcher>) -> Result<()>;
    async fn run(&mut self, space: &Space, dispatcher: Arc<Dispatcher>) -> Result<()>;
    async fn finish(
        &mut self,
        space: &Space,
        dispatcher: Arc<Dispatcher>,
        task_status: i32,
    ) -> Result<()>;
    fn hash(&self) -> u64;
    fn queue(&mut self, queue: VecDeque<Box<dyn DTask>>);
}

#[derive(Serialize)]
pub struct TaskState<Task: TaskExec> {
    info: Task::Info,
    data: Option<Task::Data>,
}

pub struct Task<T: TaskExec> {
    id: Uuid,
    parent_id: Option<Uuid>,
    file_id: Option<Uuid>,
    space_id: Option<Uuid>,
    task_info: TaskState<T>,
    task_with_state: T,
    queue: VecDeque<Box<dyn DTask>>,
}

pub trait IntoTask<T: TaskExec + 'static> {
    fn runnable(self) -> Box<dyn DTask>;
}

impl<T, Info> IntoTask<T> for Info
where
    T: TaskExec<Info = Info> + 'static,
    Info: TaskInfo<Task = T>,
{
    fn runnable(self) -> Box<dyn DTask> {
        Task::new(self)
    }
}

impl<T, Info> IntoTask<T> for Box<Task<T>>
where
    T: TaskExec<Info = Info> + 'static,
    Info: TaskInfo<Task = T>,
{
    fn runnable(self) -> Box<dyn DTask> {
        self
    }
}

impl<T, Info> Task<T>
where
    T: TaskExec<Info = Info> + 'static,
    Info: TaskInfo<Task = T>,
{
    fn new(info: Info) -> Box<Self> {
        let id = Uuid::new_v4();
        Box::new(Self {
            id,
            parent_id: None,
            file_id: None,
            space_id: None,
            task_info: TaskState { info, data: None },
            task_with_state: TaskExec::new(),
            queue: VecDeque::new(),
        })
    }
}

#[async_trait::async_trait]
impl<T: TaskExec> DTask for Task<T> {
    fn id(&self) -> Uuid {
        self.id
    }

    fn parent_id(&self) -> Option<Uuid> {
        self.parent_id
    }

    fn space_id(&self) -> Option<Uuid> {
        self.space_id
    }

    fn task_type(&self) -> &'static str {
        <T as TaskExec>::TYPE
    }

    fn file_id(&self) -> Option<Uuid> {
        self.file_id
    }

    fn hash(&self) -> u64 {
        <T::Info as TaskInfo>::hash(&self.task_info.info)
    }

    fn queue(&mut self, next_queue: VecDeque<Box<dyn DTask>>) {
        self.queue = next_queue;
    }

    async fn setup(&mut self, space: &Space, _dispatcher: Arc<Dispatcher>) -> Result<()> {
        let self_id = self.id;
        let self_hash = self.hash().to_string();
        let self_task_type = self.task_type().to_string();
        let task_data = space
            .clone()
            .db
            .task()
            .create(
                u2b(self_id),
                self_hash,
                self_task_type,
                db_space::id::equals(u2b(space.clone().id)),
                vec![task::status::set(0)],
            )
            .exec()
            .await?;

        self.id = Uuid::from_slice(&task_data.id).unwrap();

        debug!("Created task in db{}", self_id);

        let _res = self
            .task_with_state
            .setup(space, self.id, &mut self.task_info)
            .await?;

        debug!("Setup task in wrapper{}", self_id);

        Ok(())
    }

    async fn run(&mut self, space: &Space, _dispatcher: Arc<Dispatcher>) -> Result<()> {
        let _res = self
            .task_with_state
            .run(space, self.id, &mut self.task_info)
            .await?;
        Ok(())
    }

    async fn finish(
        &mut self,
        space: &Space,
        _dispatcher: Arc<Dispatcher>,
        task_status: i32,
    ) -> Result<()> {
        let _res = self
            .task_with_state
            .finish(space, self.id, &mut self.task_info)
            .await?;
        let _r = space
            .db
            .task()
            .update(
                task::id::equals(u2b(self.id)),
                vec![task::status::set(task_status)],
            )
            .exec()
            .await
            .with_context(|| {
                format!(
                    "Failed to update task status to {} for task {}",
                    task_status, self.id
                )
            })?;

        Ok(())
    }
}
