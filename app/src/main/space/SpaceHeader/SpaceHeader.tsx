import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components/macro';
import { useAppContext, useSpaceMutation } from '~/rspc';
import { RowFixed, SpaceSubtitle, SpaceTitle } from '~/ui';

const SpaceHeaderRow = styled.div`
	display: flex;
	// flex-direction: row;
	// align-items: flex-end;
	padding: 0px;
	gap: 9px;
`;

const Input = styled.input<{ width: number }>`
	all: unset;
	width: fit-content;
	display: flex;
	border-radius: 4px;
	border: none;
	height: 35px;
	line-height: 1;
	&:focus {
		// box-shadow: ${({ theme }) => theme.shadow1Base};
		// background: none;
		// overflow: visible;
	}
	flex-shrink: 1;
	max-width: ${({ width }) => width ?? 100}px;
	min-width: 24px;
`;

export default () => {
	const { space } = useAppContext();

	const [spaceTitle, setSpaceTitle] = useState(space?.meta.name ?? '');
	const [spaceSubtitle, setSpaceSubtitle] = useState(space?.meta.description ?? '');

	const [editLive, setEditLive] = useState(false);

	useEffect(() => {
		if (editLive) return;
		setSpaceTitle(space?.meta.name ?? '');
		setSpaceSubtitle(space?.meta.description ?? '');
	}, [space]);

	const edit = useSpaceMutation('spaces.edit');

	const theme = useTheme();

	return (
		<SpaceHeaderRow>
			<Input
				style={{
					fontSize: 18.3,
					color: theme?.text1,
					fontWeight: 550
				}}
				value={spaceTitle}
				onChange={(e: any) => {
					setEditLive(true);
					if (e.target.value.length > 22) return;
					setSpaceTitle(e.target.value);
				}}
				onBlur={() => {
					setEditLive(false);
					edit.mutate({ name: spaceTitle ?? null, description: spaceSubtitle ?? null });
					console.log('blur. set title to', spaceTitle);
				}}
				width={spaceTitle.length * 10}
			/>
			<Input
				style={{
					fontSize: 14,
					color: theme?.text2,
					fontWeight: 450
				}}
				value={spaceSubtitle}
				onChange={(e: any) => {
					setEditLive(true);
					if (e.target.value.length > 24) return;
					setSpaceSubtitle(e.target.value);
				}}
				onBlur={() => {
					setEditLive(false);
					edit.mutate({ name: spaceTitle ?? null, description: spaceSubtitle ?? null });
					console.log('blur. set subtitle to', spaceSubtitle);
				}}
				width={spaceSubtitle.length * 6}
			/>
		</SpaceHeaderRow>
	);
};
