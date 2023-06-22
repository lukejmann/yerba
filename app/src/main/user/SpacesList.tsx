import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components/macro';
import { useUserMutation } from '~/rspc';
import { ItemSubtitle, ItemTitle, RowBetween, SectionHeader } from '~/ui';
import { AutoRow } from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import SectionButton from '~/ui/buttons';
import { useSpacesContext } from './SpacesProvider';

const SpaceWrapper = styled(Link)<{ selected?: boolean }>`
	text-decoration: none;
	display: flex;
	flex-direction: row;
	// grid-template-columns: 200px 1fr;
	height: fit-content;
	// truncate right if too long
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	align-items: center;
	padding: 9.85892px;
	gap: 8.22px;
	border-radius: 9px;
	background: ${({ selected, theme }) =>
		selected ? theme.backgroundFloatingBase : theme.backgroundFloatingNone};
	border: ${({ selected, theme }) => (selected ? theme.border2Base : theme.border2None)};
	box-shadow: ${({ selected, theme }) => (selected ? theme.shadow1Base : theme.shadow1None)};
	backdrop-filter: ${({ selected, theme }) =>
		selected ? theme.backdropFilterBase : theme.backdrop1Nonde};
	transition: all 0.1s ease;
	z-index: 1;
`;

export default () => {
	const { spaces, currentSpaceId } = useSpacesContext();
	console.log('spaces', spaces);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const createSpace = useUserMutation('spaces.create', {
		onSuccess: (space) => {
			console.log('space', space);
			queryClient.setQueryData(['spaces.list'], (spaces: any) => [...(spaces || []), space]);

			navigate(`/${space.id}`, { replace: true });
		},
		onError: (e) => {
			console.error('Failed to create space', e);
		}
	});
	return (
		<FloatingBarWithContent
			scrollContent={spaces.data?.map((lib) => (
				<SpaceWrapper to={`/${lib.id}`} key={lib.id} selected={lib.id === currentSpaceId}>
					<ItemTitle style={{ display: 'flex' }}>{lib.meta.name}</ItemTitle>
					<ItemSubtitle style={{ width: 'fit-content' }}>{lib.meta.description}</ItemSubtitle>
				</SpaceWrapper>
			))}
			topBarContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Spaces</SectionHeader>
					<SectionButton
						onClick={() => {
							console.log('createSpace', createSpace);
							createSpace.mutate({
								name: 'New Space'
							});
						}}
						text="New"
					/>
				</RowBetween>
			}
		/>
	);
};
