use crate::space::Space;
use anyhow::Result;

use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use tokio::sync::{mpsc, oneshot, RwLock, Semaphore};
use tracing::{debug, error, info};

use super::DTask;

pub enum DispatcherEvent {
    Shutdown(oneshot::Sender<()>),
}

#[derive(Debug)]
pub enum TaskCommand {
    CompletedExternally,
}

pub struct Dispatcher {
    running: RwLock<HashMap<Uuid, tokio::task::JoinHandle<()>>>,
    running_txs: RwLock<HashMap<Uuid, tokio::sync::mpsc::Sender<TaskCommand>>>,
    dispatcher_tx: mpsc::UnboundedSender<DispatcherEvent>,
    sem: Arc<Semaphore>,
}

impl Dispatcher {
    pub fn new() -> Arc<Self> {
        let (dispatcher_tx, mut dispatcher_rx) = mpsc::unbounded_channel();
        let sem = Arc::new(Semaphore::new(100)); // Adjust as needed

        let this = Arc::new(Self {
            running: RwLock::new(HashMap::new()),
            running_txs: RwLock::new(HashMap::new()),
            dispatcher_tx,
            sem,
        });

        let _this2 = this.clone();
        tokio::spawn(async move {
            while let Some(event) = dispatcher_rx.recv().await {
                match event {
                    DispatcherEvent::Shutdown(signal_tx) => {
                        info!("Shutting down task manager");
                        signal_tx.send(()).ok();
                    }
                }
            }
        });
        debug!("Dispatcher initialized");
        this
    }

    pub async fn dispatch(
        self: Arc<Self>,
        space: &Space,
        mut task: Box<dyn DTask>,
    ) -> Result<Uuid> {
        // STEP 1: We initialize the task and put it in the db
        task.setup(&space.clone(), self.clone()).await?;

        let (task_tx, _task_rx) = mpsc::channel(1);
        let dispatcher = self.clone();
        let sem = self.sem.clone();
        let space = space.clone();
        let task_id: Uuid = task.id();

        let task_fut = {
            let sem_clone = sem.clone(); // Clone Semaphore for use in async block
            tokio::spawn({
                async move {
                    info!("Task {} started", task_id);
                    let permit = sem_clone.acquire().await.unwrap(); // Acquire permit

                    info!("Task {} acquired permit", task_id);

                    // STEP 2: We attempt to run the task when a worker is available
                    let result = task.run(&space, dispatcher.clone()).await;

                    // STEP 3: We mark the task as completed in the db
                    let task_status = match &result {
                        Ok(_) => 2,
                        Err(_) => 1,
                    };

                    let finish_result = task.finish(&space, dispatcher, task_status).await;
                    if let Err(e) = finish_result {
                        error!("Failed to finish task: {:?}", e);
                    }
                    drop(permit);
                }
            })
        };

        let mut running_tasks = self.running.write().await;
        running_tasks.insert(task_id, task_fut);

        let mut task_senders = self.running_txs.write().await;
        task_senders.insert(task_id, task_tx);

        info!("Task {} dispatched", task_id);

        Ok(task_id)
    }

    pub async fn list(&self) -> Result<Vec<Uuid>> {
        let mut tasks = Vec::new();
        let running_tasks = self.running.read().await;
        for (task_id, _task_fut) in running_tasks.iter() {
            tasks.push(*task_id);
        }
        Ok(tasks)
    }

    pub async fn shutdown(&self) {
        let (tx, rx) = oneshot::channel();
        self.dispatcher_tx
            .send(DispatcherEvent::Shutdown(tx))
            .unwrap_or_else(|_| {
                error!("Failed to send shutdown event to task manager!");
            });

        rx.await.unwrap_or_else(|_| {
            error!("Failed to receive shutdown event response from task manager!");
        });
    }
}
