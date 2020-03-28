import Arrow from './Arrow'
import Dots from '../Dots'
import User from './User'
import bind from 'autobind-decorator'
import { Component, Fragment, h } from 'preact'

export default class PostMedia extends Component {
	static volume = 1

	state = {
		carouselIndex: 0,
		carouselLen: 0,
		isCarousel: false,
	}

	constructor(props) {
		super(props)

		const carousel = props.data.edge_sidecar_to_children
		if (carousel !== undefined) {
			this.state.isCarousel = true
			this.state.carouselLen = carousel.edges.length
		}
	}

	@bind
	handleArrowClick(e) {
		e.stopPropagation()
		e.preventDefault()

		this.setState((previousState, properties) => {
			let newIndex = previousState.carouselIndex
			if (e.currentTarget.classList.contains('ige_carousel-btn--left')) --newIndex
			else ++newIndex

			if (newIndex < 0) newIndex = previousState.carouselLen - 1
			else if (newIndex >= previousState.carouselLen) newIndex = 0

			return { carouselIndex: newIndex }
		})
	}

	shouldComponentUpdate(nextProperties, nextState) {
		if (this.state.carouselIndex !== nextState.carouselIndex) return true
		return false
	}

	setVolume(e) {
		PostMedia.volume = e.target.volume
	}

	getMedia(media) {
		if (media.is_video) {
			// video
			return (
				<video
					src={media.video_url}
					poster={media.display_url}
					type="video/mp4"
					preload="metadata"
					class="img-fluid"
					intrinsicsize={media.dimensions !== undefined ? `${media.dimensions.width}x${media.dimensions.height}` : undefined}
					controls
					onVolumeChange={this.setVolume}
				/>
			)
		}

		return (
			<img
				src={media.display_url}
				alt={media.accessibility_caption}
				class="img-fluid"
				decoding="async"
				intrinsicsize={media.dimensions !== undefined ? `${media.dimensions.width}x${media.dimensions.height}` : undefined}
			/>
		)
	}

	toggleTaggedUsers(e) {
		e.currentTarget.parentElement.classList.toggle('ige_show_tagged')
	}

	getTaggedUsers(edges) {
		if (edges?.length === 0) return null

		return (
			<>
				{edges.map(v => {
					const node = v.node,
						username = node.user.username

					return (
						<div class="ige_taggedUser" style={{ left: node.x * 100 + '%', top: node.y * 100 + '%' }}>
							<a href={'/' + username + '/'}>{node.user.full_name || username}</a>
						</div>
					)
				})}
				<button type="button" class="ige_button ige_post_userIcon" onClick={this.toggleTaggedUsers}>
					<User size="24" fill="white" />
				</button>
			</>
		)
	}

	render() {
		const { data } = this.props
		const { carouselIndex, carouselLen, isCarousel } = this.state

		let mediaElement

		if (isCarousel) {
			mediaElement = data.edge_sidecar_to_children.edges.map((v, i) => (
				<div key={v.id} class={i === carouselIndex ? 'active' : ''}>
					{this.getMedia(v.node)}
					{this.getTaggedUsers(v.node.edge_media_to_tagged_user?.edges)}
				</div>
			))
		} else {
			mediaElement = (
				<div class="active">
					{this.getMedia(data)}
					{this.getTaggedUsers(data.edge_media_to_tagged_user?.edges)}
				</div>
			)
		}

		return (
			<div class="p-relative">
				<div class="img--wrapper">{mediaElement}</div>
				{isCarousel && carouselIndex !== 0 ? (
					<button type="button" class="ige_button ige_carousel-btn ige_carousel-btn--left" onClick={this.handleArrowClick}>
						<Arrow direction="left" size="30" fill="gray" />
					</button>
				) : null}
				{isCarousel ? (
					<button type="button" class="ige_button ige_carousel-btn ige_carousel-btn--right" onClick={this.handleArrowClick}>
						<Arrow direction="right" size="30" fill="gray" />
					</button>
				) : null}
				{isCarousel ? <Dots index={carouselIndex} len={carouselLen} /> : null}
			</div>
		)
	}
}
