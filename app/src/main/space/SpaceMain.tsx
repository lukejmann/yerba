import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components/macro';
import { useUserMutation } from '~/rspc';
import { RowBetween, RowFixed, SectionHeader } from '~/ui';
import SectionButton from '~/ui/buttons';
import { ContentPanel, ContentPanelGroup, ContentPanelResizeHandle } from '../user/Layout';
import SpacesList from '../user/SpacesList';
import { useSpacesContext } from '../user/SpacesProvider';
import SpaceHeader from './SpaceHeader/SpaceHeader';
import Chat from './chat';
import Files from './files';
import Preview from './preview';

const SpaceContainer = styled.div`
	box-sizing: border-box;

	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: 16px 20px;
	gap: 10px;

	width: 100%;
	height: 100%;

	background: rgba(255, 255, 255, 0.01);

	border: 1px solid #e6e6e6;

	box-shadow: -39px 30px 90px rgba(0, 0, 0, 0.1);
	// backdrop-filter: blur(1px);

	border-radius: 7px;

	flex: none;
	order: 2;
	align-self: stretch;
	flex-grow: 1;
	overflow: visible;
	z-index: 10;
`;

export default () => {
	const { currentSpaceId, space } = useSpacesContext();
	const navigate = useNavigate();

	const deleteSpace = useUserMutation('spaces.delete', {
		onSuccess: (space) => {
			navigate('/', { replace: true });
		},
		onError: (e) => {
			console.error('Failed to delete space', e);
		}
	});
	return (
		<SpaceContainer>
			<RowBetween>
				<SpaceHeader></SpaceHeader>
				{space && (
					<SectionButton
						onClick={() => {
							if (!space) return;
							deleteSpace.mutate({
								id: space?.id
							});
						}}
						text="Delete"
					/>
				)}
			</RowBetween>
			<ContentPanelGroup autoSaveId="spaceHorizontal" direction="horizontal">
				<ContentPanel defaultSize={30} minSize={15}>
					<ContentPanelGroup autoSaveId="spaceLeftVert" direction="vertical">
						<ContentPanel defaultSize={60} minSize={30}>
							<Files />
						</ContentPanel>
						<ContentPanelResizeHandle direction="vertical" />
						<ContentPanel defaultSize={40}>
							<Preview />
						</ContentPanel>
					</ContentPanelGroup>
				</ContentPanel>
				<ContentPanelResizeHandle direction="horizontal" />
				<ContentPanel minSize={15} defaultSize={70}>
					<Chat />
				</ContentPanel>
			</ContentPanelGroup>
		</SpaceContainer>
	);
};
