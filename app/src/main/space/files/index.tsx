import { useEffect, useMemo, useState } from 'react';
import styled, { css, keyframes, useTheme } from 'styled-components/macro';
import { proxy, useSnapshot } from 'valtio';
import { useSpacesContext } from '~/main/user/SpacesProvider';
import { FileWithTasks, useSpaceMutation, useSpaceQuery, useSpaceSubscription } from '~/rspc';
import {
	ItemStatus,
	ItemSubtitle,
	ItemTitle,
	RowBetween,
	RowFlat,
	SectionHeader,
	opacify
} from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import SectionButton from '~/ui/buttons';
import { useUploader } from './useUploader';

const FileWrapper = styled.div<{ selected?: boolean }>`
	text-decoration: none;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	max-width: 100%;
	overflow: hidden;
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
	selectedFile: null as null | FileWithTasks
});

enum FileStatus {
	Uploading = 0,
	Uploaded = 1,
	Learning = 2,
	Learned = 3,
	Failed = 4,
	NotSupported = 5
}

enum TaskStatus {
	InProgress = 0,
	Completed = 1,
	Failed = 2
}

export default () => {
	const { space, spaces, currentSpaceId } = useSpacesContext();

	useEffect(() => {
		filesStore.selectedFile = null;
	}, [currentSpaceId]);

	const { selectedFile } = useSnapshot(filesStore);

	const [queryFiles, setQueryFiles] = useState([] as FileWithTasks[]);

	const { data: qFiles } = useSpaceQuery(['files.list']);
	useEffect(() => {
		console.log('qFiles', qFiles);
		setQueryFiles(qFiles ?? []);
		// setQueryFiles(qFiles?.map((q) => q.file_with_tasks));
		// console.log('queryFiles', queryFiles);
	}, [qFiles]);
	// console.log('files', files);

	// const queryClient = useQueryClient();
	const [subFiles, setSubFiles] = useState([] as FileWithTasks[]);

	useSpaceSubscription(['files.updates'], {
		onStarted: () => {
			console.log('files.updates init');
		},
		onError: (err) => {
			console.error('files.updateserror', err);
		},
		onData: (updatedFiles) => {
			console.log('files.updates data', updatedFiles);
			setSubFiles(updatedFiles);
		}
	});

	const files = useMemo(() => {
		const mapById = new Map<string, FileWithTasks[]>();
		const all = [...(queryFiles ?? []), ...subFiles];
		console.log('all', all);
		all.forEach((m) => {
			const files = mapById.get(m.id_str) ?? [];
			mapById.set(m.id_str, [...files, m]);
		});

		// TODO: just switch to server side tracking in file objects
		const files = [...mapById.values()]
			.map((files) => {
				const sorted = files.sort((a, b) => {
					const aHighestTask = a.tasks.sort(
						(a, b) => new Date(b.date_modified).valueOf() - new Date(a.date_modified).valueOf()
					)[0];
					const bHighestTask = b.tasks.sort(
						(a, b) => new Date(b.date_modified).valueOf() - new Date(a.date_modified).valueOf()
					)[0];
					return (
						new Date(bHighestTask?.date_modified ?? 0).valueOf() -
						new Date(aHighestTask?.date_modified ?? 0).valueOf()
					);
				});
				return sorted[0];
			})
			.sort((a, b) => {
				const aCreated = new Date(a?.date_created ?? 0).valueOf();
				const bCreated = new Date(b?.date_created ?? 0).valueOf();
				return bCreated - aCreated;
			});

		console.log('files', files);

		// console

		return files;
	}, [queryFiles, subFiles]);

	console.log('files', files);

	useEffect(() => {
		if (!selectedFile && files && files?.length > 0) {
			filesStore.selectedFile = files[0] ?? null;
		}
	}, [files]);

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
	const theme = useTheme();

	return (
		<FloatingBarWithContent
			border={theme?.border1Light}
			// @ts-ignore
			onDrop={handleDrop}
			onDropCapture={handleDrop}
			onDragOver={handleDragOver}
			onDragOverCapture={handleDragOver}
			onDragEnterCapture={handleDragOver}
			onDragLeave={handleDragLeave}
			onDragLeaveCapture={handleDragLeave}
			onDragEnd={handleDragLeave}
			scrollContent={files?.map((file) =>
				file ? <FileRow key={file?.id_str} file={file} /> : null
			)}
			emptyState={<ItemStatus>Drag and drop files here to upload</ItemStatus>}
			topBarContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Files</SectionHeader>
				</RowBetween>
			}
		/>
	);
};

const FileRow = ({ file }: { file: FileWithTasks }) => {
	const [status, setStatus] = useState<FileStatus>(0);

	const { selectedFile } = useSnapshot(filesStore);

	const subKey = file.id_str;

	// TODO: just switch to server side tracking in file objects
	useEffect(() => {
		const tasks = file.tasks;
		const uploadingTasksRunning = tasks.filter(
			(task) => task.task_type === 'file_upload' && task.status === TaskStatus.InProgress
		);
		const uploadingTasksCompleted = tasks.filter(
			(task) => task.task_type === 'file_upload' && task.status === TaskStatus.Completed
		);

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

		const status =
			file.supported || learningTasksCompleted.length > 0
				? FileStatus.Learned
				: learningTasksRunning.length > 0
				? FileStatus.Learning
				: !file.supported
				? FileStatus.NotSupported
				: uploadingTasksCompleted.length > 0
				? FileStatus.Uploaded
				: uploadingTasksRunning.length > 0
				? FileStatus.Uploading
				: FileStatus.Failed;
		console.log('status', status);
		setStatus(status);
	}, [file]);

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
				<ItemSubtitle>{file.extension.replace('.', '').toUpperCase()}</ItemSubtitle>
			</RowFlat>
			<FileStatusIndicatorRow status={status} />
			<RowBetween>
				{status === FileStatus.Uploaded && (
					<SectionButton
						text="Learn"
						onClick={() => {
							learnFile.mutate({ file_id: file.id_str });
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
		case FileStatus.NotSupported:
			return '#f0f0f0';
	}
};

const pulse = keyframes`
0% {
	transform: scale(0.95);
	
}

70% {
	transform: scale(1);
	
}

100% {
	transform: scale(0.95);
	
}
`;

const FileStatusIndicator = styled.div<{ status: FileStatus }>`
	width: 4.93px;
	height: 4.93px;
	background: ${(props) => indicatorToColor(props.status)};
	box-shadow: 0px 0px 4.92946px 1.64315px
		${(props) => opacify(0.25, indicatorToColor(props.status))};
	border-radius: 9.85892px;

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
