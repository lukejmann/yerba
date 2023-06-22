/* eslint-disable */
// This file was generated by [rspc](https://github.com/oscartbeaumont/rspc). Do not edit this file manually.

export type Procedures = {
    queries: 
        { key: "files.list", input: SpaceArgs<null>, result: FileWrapped[] } | 
        { key: "invalidation.test-invalidate", input: never, result: number } | 
        { key: "spaces.list", input: UserArgs<null>, result: SpaceWrapped[] } | 
        { key: "tasks.list", input: SpaceArgs<null>, result: Task[] },
    mutations: 
        { key: "invalidation.test-invalidate-mutation", input: SpaceArgs<null>, result: null } | 
        { key: "spaces.create", input: UserArgs<CreateSpaceArgs>, result: SpaceWrapped } | 
        { key: "spaces.delete", input: UserArgs<DeleteSpaceArgs>, result: null } | 
        { key: "spaces.edit", input: SpaceArgs<EditSpaceArgs>, result: Meta } | 
        { key: "tasks.learnFile", input: SpaceArgs<LearnFileTaskInfo>, result: null } | 
        { key: "tasks.uploadFile", input: SpaceArgs<FileUploadTaskInfo>, result: null } | 
        { key: "users.create", input: never, result: UserWithToken },
    subscriptions: 
        { key: "invalidation.listen", input: never, result: InvalidateOperationEvent[] } | 
        { key: "tasks.updates", input: SpaceArgs<null>, result: Task[] }
};

export type CreateSpaceArgs = { name: string }

export type DeleteSpaceArgs = { id: string }

export type EditSpaceArgs = { name: string | null; description: string | null }

export type FileUploadTaskInfo = { path: string }

export type FileWithTasks = { id: number[]; path: string; name: string; extension: string; status: number; size: number; date_created: string; date_modified: string; date_indexed: string; space_id: number[]; tasks: { id: number[]; task_type: string; status: number }[] }

export type FileWrapped = { id: string; name: string; file_with_tasks: FileWithTasks }

export type InvalidateOperationEvent = { key: string; arg: any; result: any | null }

export type LearnFileTaskInfo = { file_id: string }

export type Meta = { id: number[]; name: string; description: string; color: string | null }

/**
 * Can wrap a query argument to require it to contain a `space_id` and provide helpers for working with spaces.
 */
export type SpaceArgs<T> = { jwt_token: string; space_id: string; arg: T }

export type SpaceWrapped = { id: string; meta: Meta }

export type Task = { id: number[]; hash: string; status: number; task_type: string; space_id: number[]; file_id: number[] | null }

export type User = { id: number[]; account_attached: boolean }

/**
 * Can wrap a query argument to require it to contain a `user_id` and provide helpers for working with users.
 */
export type UserArgs<T> = { jwt_token: string; arg: T }

export type UserWithToken = { user: User; token: string }
