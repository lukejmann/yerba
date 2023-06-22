import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components/macro';
import { proxy, subscribe, useSnapshot } from 'valtio';
import { proxyMap, subscribeKey } from 'valtio/utils';
import { useSpacesContext } from '~/main/user/SpacesProvider';
import {
	File,
	FileWithTasks,
	FileWrapped,
	Task,
	useSpaceMutation,
	useSpaceQuery,
	useSpaceSubscription
} from '~/rspc';
import { ItemSubtitle, ItemTitle, RowBetween, RowFlat, SectionHeader, opacify } from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import SectionButton from '~/ui/buttons';
import { useUploader } from './useUploader';

const FileWrapper = styled.div<{ selected?: boolean }>`
	text-decoration: none;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	// width: 100%;
	margin-right: 8px;
	align-items: center;
	padding: 9.85892px 6px 9.85892px 12px;
	gap: 8.22px;
	border-radius: 8px;
	background: ${({ selected, theme }) =>
		selected ? theme.backgroundFloatingBase : theme.backgroundFloatingNone};
	border: ${({ selected, theme }) => (selected ? theme.border1None : theme.border1None)};
	box-shadow: ${({ selected, theme }) => (selected ? theme.shadow1Base : theme.shadow1None)};
	backdrop-filter: ${({ selected, theme }) =>
		selected ? theme.backdropFilterBase : theme.backdrop1Nonde};
	transition: all 0.1s ease;
	z-index: 1;
	&:hover {
		cursor: default;
	}
`;

export const filesStore = proxy({
	selectedFile: null as null | FileWrapped
});

// export const fileIdToActiveTasks = proxyMap(
// 	new Map<string, { id_str: string; task_type: string; status: number }[]>()
// );

// const subscribeMapKey = <K extends unknown, V extends unknown>(
// 	proxyMapObject: Map<K, V>,
// 	key: K,
// 	callback: (v: V | undefined) => void
// ) => {
// 	let prev: V | undefined;
// 	return subscribe(proxyMapObject, () => {
// 		const nextValue = proxyMapObject.get(key);
// 		if (!prev || prev !== nextValue) {
// 			prev = nextValue;
// 			callback(nextValue);
// 		}
// 	});
// };

export default () => {
	const { space, spaces, currentSpaceId } = useSpacesContext();

	useEffect(() => {
		filesStore.selectedFile = null;
	}, [currentSpaceId]);

	const { selectedFile } = useSnapshot(filesStore);

	const { data: files } = useSpaceQuery(['files.list']);
	useEffect(() => {
		if (!selectedFile && files && files?.length > 0) {
			filesStore.selectedFile = files[0] ?? null;
		}
	}, [files]);

	console.log('files', files);

	const queryClient = useQueryClient();

	// TODO: move out of here
	useSpaceSubscription(['files.updates'], {
		onStarted: () => {
			console.log('tasks.updates init');
		},
		onError: (err) => {
			console.error('tasks.updates error', err);
		},
		onData: (updatedFiles) => {
			// replace the task in the map
			console.log('tasks.updates data', updatedFiles);
			queryClient.setQueryData(['files.list'], (lastFiles: FileWithTasks[] | undefined) => {
				if (!lastFiles) return undefined;
				const newFiles = lastFiles.map((file) => {
					const inUpdated = updatedFiles.find((f) => f.id === file.id);
					if (!inUpdated) return file;
					return inUpdated;
				});
			});
		}
	});

	const { setItems } = useUploader();

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();

		setItems(e.dataTransfer.items);
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	};

	return (
		<FloatingBarWithContent
			// @ts-ignore
			onDrop={handleDrop}
			onDropCapture={handleDrop}
			onDragOver={handleDragOver}
			onDragOverCapture={handleDragOver}
			onDragEnterCapture={handleDragOver}
			onDragLeave={handleDragLeave}
			onDragLeaveCapture={handleDragLeave}
			onDragEnd={handleDragLeave}
			scrollContent={files?.map((file) => (
				<FileRow file={file} />
			))}
			barContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Files</SectionHeader>
				</RowBetween>
			}
		/>
	);
};

enum FileStatus {
	Uploading = 0,
	Uploaded = 1,
	Learning = 2,
	Learned = 3,
	Failed = 4,
	Unsupported = 5
}

enum TaskStatus {
	InProgress = 0,
	Completed = 1,
	Failed = 2
}

const FileRow = ({ file }: { file: FileWrapped }) => {
	const [status, setStatus] = useState<FileStatus>(0);

	const { selectedFile } = useSnapshot(filesStore);

	const subKey = file.file_with_tasks.id_str;

	useEffect(() => {
		const tasks = file.file_with_tasks.tasks;
		const uploadingTasksRunning = tasks.filter(
			(task) => task.task_type === 'file_upload' && task.status === TaskStatus.InProgress
		);
		const uploadingTasksCompleted = tasks.filter(
			(task) => task.task_type === 'file_upload' && task.status === TaskStatus.Completed
		);
		// console;
		const learningTasksRunning = tasks.filter(
			(task) => task.task_type === 'learn_file' && task.status === TaskStatus.InProgress
		);
		const learningTasksCompleted = tasks.filter(
			(task) => task.task_type === 'learn_file' && task.status === TaskStatus.Completed
		);
		console.log('uploadingTasksRunning', uploadingTasksRunning);
		console.log('uploadingTasksCompleted', uploadingTasksCompleted);
		console.log('learningTasksRunning', learningTasksRunning);
		console.log('learningTasksCompleted', learningTasksCompleted);
		setStatus(() => {
			if (learningTasksCompleted.length > 0) return FileStatus.Learned;
			if (learningTasksRunning.length > 0) return FileStatus.Learning;
			if (!file.file_with_tasks.supported) return FileStatus.Unsupported;
			if (uploadingTasksCompleted.length > 0) return FileStatus.Uploaded;
			if (uploadingTasksRunning.length > 0) return FileStatus.Uploading;
			return FileStatus.Failed;
		});
	}, [file.file_with_tasks]);

	const learnFile = useSpaceMutation('tasks.learnFile');

	return (
		<FileWrapper
			key={`${file.id}`}
			selected={selectedFile?.id === file.id}
			onClick={() => {
				filesStore.selectedFile = file;
			}}
		>
			<RowFlat style={{ gap: '4px', width: '100%' }}>
				<ItemTitle>{file.name}</ItemTitle>
				<ItemSubtitle>{file.file_with_tasks.extension.replace('.', '').toUpperCase()}</ItemSubtitle>
			</RowFlat>
			{/* <div style={{ flex: 1, flexGrow: 1, background: 'red', width: '100%', height: '5px' }}></div> */}
			<FileStatusIndicatorRow status={status} />

			<RowBetween>
				{status === FileStatus.Uploaded && isDev && (
					<SectionButton
						text="Learn"
						onClick={() => {
							learnFile.mutate({ file_id: file.id.toString() });
							console.log('learnFile', file.id.toString());
						}}
					></SectionButton>
				)}
			</RowBetween>
		</FileWrapper>
	);
};

const FileStatusRow = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	padding: 0px;
	gap: 8.22px;
`;

const indicatorToColor = (status: FileStatus) => {
	switch (status) {
		case FileStatus.Uploading:
			return '#a89b73';
		case FileStatus.Uploaded:
			return '#c9c907';
		case FileStatus.Learning:
			return '#d3ee84';
		case FileStatus.Learned:
			return '#0fd804';
		case FileStatus.Failed:
			return '#d83904';
		case FileStatus.Unsupported:
			return '#f0f0f0';
	}
};

const pulse = keyframes`
0% {
	transform: scale(0.95);
	// box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.7);
}

70% {
	transform: scale(1);
	// box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
}

100% {
	transform: scale(0.95);
	// box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
}
`;

const FileStatusIndicator = styled.div<{ status: FileStatus }>`
	width: 4.93px;
	height: 4.93px;
	background: ${(props) => indicatorToColor(props.status)};
	box-shadow: 0px 0px 4.92946px 1.64315px
		${(props) => opacify(0.25, indicatorToColor(props.status))};
	border-radius: 9.85892px;

	// slightly pulse box-shadow if status is uploading or learning
	animation: ${(props) =>
		props.status === FileStatus.Uploading || props.status === FileStatus.Learning
			? css`
					${pulse} 1s infinite
			  `
			: ''};
`;

const FileStatusText = styled.div`
	font-weight: 700;
	font-size: 9.82263px;
	line-height: 12px;

	letter-spacing: -0.005em;

	color: #6e6e6e;
`;

const FileStatusIndicatorRow = ({ status }: { status: FileStatus }) => {
	return (
		<FileStatusRow>
			<FileStatusIndicator status={status} />
			<FileStatusText>{FileStatus[status]}</FileStatusText>
		</FileStatusRow>
	);
};
