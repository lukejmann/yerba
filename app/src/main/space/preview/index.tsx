import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import styled from 'styled-components/macro';
import { proxy, useSnapshot } from 'valtio';
import { http, serverOrigin } from '~/App';
import { useAppContext, useSpaceQuery } from '~/rspc';
import { ItemSubtitle, ItemTitle, RowBetween, RowFixed, RowFlat, SectionHeader } from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import { filesStore } from '../files';

export default () => {
	const { selectedFile } = useSnapshot(filesStore);
	const { space } = useAppContext();

	return (
		<FloatingBarWithContent
			scrollContent={[
				<Viewer
					spaceId={space?.id.toString() || undefined}
					selectedFileId={selectedFile?.id.toString() || undefined}
					selectedFileExtension={selectedFile?.file_with_tasks.extension}
					key={selectedFile?.id ?? '1'}
				/>
			]}
			barContent={
				<RowFixed
					style={{
						gap: '8.22px'
					}}
				>
					<SectionHeader>{selectedFile?.name}</SectionHeader>
					<ItemSubtitle>{selectedFile?.file_with_tasks.extension.toUpperCase()}</ItemSubtitle>
				</RowFixed>
			}
		/>
	);
};

export const Viewer = memo(
	({
		spaceId,
		selectedFileId,
		selectedFileExtension: ext,
		onLoad,
		onError,
		crossOrigin
	}: {
		spaceId?: string;
		selectedFileId?: string;
		selectedFileExtension?: string;
		onLoad?: (event: HTMLElementEventMap['load']) => void;
		onError?: (event: HTMLElementEventMap['error']) => void;
		crossOrigin?: React.ComponentProps<'link'>['crossOrigin'];
	}) => {
		const src =
			spaceId && selectedFileId
				? `${http}://${serverOrigin}/yerb/file/${encodeURIComponent(spaceId)}/${encodeURIComponent(
						selectedFileId
				  )}`
				: null;

		const href = !src || src === '#' ? null : src;

		const link = useMemo(() => {
			if (href == null) return null;

			const link = document.createElement('link');
			link.as = 'fetch';
			link.rel = 'preload';
			if (crossOrigin) link.crossOrigin = crossOrigin;
			link.href = href;
			link.style.width = '10% !important';

			link.addEventListener('load', () => link.remove());
			link.addEventListener('error', () => link.remove());

			return link;
		}, [crossOrigin, href]);

		useLayoutEffect(() => {
			if (!link) return;

			if (onLoad) link.addEventListener('load', onLoad);
			if (onError) link.addEventListener('error', onError);

			return () => {
				if (onLoad) link.removeEventListener('load', onLoad);
				if (onError) link.removeEventListener('error', onError);
			};
		}, [link, onLoad, onError]);

		useLayoutEffect(() => {
			if (!link) return;
			document.head.appendChild(link);
			document.head.style.height = '100%';
			return () => link.remove();
		}, [link]);

		return link ? (
			ext == 'pdf' ? (
				<iframe src={link.href} style={{ objectFit: 'fill', width: '100%', height: '100%' }} />
			) : ext == 'jpg' || ext == 'png' ? (
				<img src={link.href} style={{ objectFit: 'unset', width: '100%' }} />
			) : ext == 'mp4' ? (
				<video src={link.href} style={{ objectFit: 'unset', width: '100%' }} />
			) : (
				<></>
			)
		) : null;
	}
);
