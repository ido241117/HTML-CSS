/**
 * Sidebar Component for Personal Hub
 * Tạo và quản lý sidebar menu chung cho tất cả các trang
 * 
 * Cách sử dụng:
 * 1. Thêm <script src="sidebar.js"></script> vào HTML
 * 2. Gọi createSidebar('tên-trang-hiện-tại') khi DOM loaded
 * 
 * Ví dụ: createSidebar('index.html')
 */

// Menu items configuration
const MENU_ITEMS = [
	{ page: 'dashboard.html', icon: '📊', label: 'Dashboard' },
	{ page: 'diary.html', icon: '📔', label: 'Diary' },
	{ page: 'music.html', icon: '🎵', label: 'Music' },
	{ page: 'book.html', icon: '📚', label: 'Book' },
	{ page: 'movie.html', icon: '🎬', label: 'Movie' },
	{ page: 'youtube.html', icon: '📺', label: 'YouTube Feed' },
	{ page: 'ytdpl.html', icon: '⬇️', label: 'YouTube DL' },
	{ page: 'calendar.html', icon: '📅', label: 'Calendar' },
	{ page: 'finance.html', icon: '💸', label: 'Finance' },
	{ page: 'settings.html', icon: '⚙️', label: 'Settings' },
	{ page: 'Design.html', icon: '⁉️', label: 'Design' }
];

/**
 * Tạo sidebar và inject vào body
 * @param {string} activePage - Tên file của trang hiện tại (vd: 'index.html')
 */
function createSidebar(activePage) {
	// Tạo sidebar container
	const sidebar = document.createElement('div');
	sidebar.className = 'sidebar';
	sidebar.id = 'sidebar';

	// Tạo header
	const header = document.createElement('div');
	header.className = 'sidebar-header';
	const title = document.createElement('div');
	title.className = 'sidebar-title';
	title.textContent = 'Personal Hub';
	header.appendChild(title);

	// Tạo menu
	const menu = document.createElement('ul');
	menu.className = 'sidebar-menu';

	MENU_ITEMS.forEach(item => {
		const li = document.createElement('li');
		li.className = 'sidebar-item';
		if (item.page === activePage) {
			li.classList.add('active');
		}
		li.onclick = () => navigate(item.page);

		const icon = document.createElement('span');
		icon.className = 'sidebar-icon';
		icon.textContent = item.icon;

		const label = document.createElement('span');
		label.textContent = item.label;

		li.appendChild(icon);
		li.appendChild(label);
		menu.appendChild(li);
	});

	// Ghép các phần lại
	sidebar.appendChild(header);
	sidebar.appendChild(menu);

	// Insert vào đầu body
	document.body.insertBefore(sidebar, document.body.firstChild);
}

/**
 * Navigate đến trang khác
 * @param {string} page - Tên file trang đích
 */
function navigate(page) {
	window.location.href = page;
}

/**
 * Inject CSS styles cho sidebar vào head
 */
function injectSidebarStyles() {
	const style = document.createElement('style');
	style.textContent = `
		/* Sidebar styles */
		.sidebar { 
			position: fixed; 
			left: 0; 
			top: 0; 
			width: 240px; 
			height: 100vh; 
			background: var(--sidebar-bg); 
			border-right: 1px solid var(--border-color); 
			z-index: 100; 
			display: flex;
			flex-direction: column;
			transition: transform 0.3s; 
		}
		
		.sidebar-header { 
			padding: 24px 20px 16px; 
			border-bottom: 1px solid var(--border-color); 
			flex-shrink: 0;
		}
		
		.sidebar-title { 
			font-size: 18px; 
			font-weight: 600; 
			color: var(--text-primary); 
			letter-spacing: 0.5px;
			text-transform: uppercase;
		}
		
		.sidebar-menu { 
			list-style: none; 
			padding: 10px 0; 
			margin: 0; 
			overflow-y: auto;
			flex: 1;
		}

		/* Custom Scrollbar */
		.sidebar-menu::-webkit-scrollbar {
			width: 6px;
		}
		.sidebar-menu::-webkit-scrollbar-track {
			background: transparent;
		}
		.sidebar-menu::-webkit-scrollbar-thumb {
			background: rgba(78, 70, 89, 0.2);
			border-radius: 10px;
			transition: background 0.3s;
		}
		.sidebar-menu:hover::-webkit-scrollbar-thumb {
			background: rgba(78, 70, 89, 0.3);
		}
		.sidebar-menu::-webkit-scrollbar-thumb:hover {
			background: rgba(78, 70, 89, 0.4);
		}

		/* Firefox support */
		.sidebar-menu {
			scrollbar-width: thin;
			scrollbar-color: rgba(78, 70, 89, 0.2) transparent;
		}
		
		.sidebar-item { 
			padding: 10px 20px; 
			margin: 2px 8px;
			border-radius: 8px;
			cursor: pointer; 
			color: var(--text-secondary); 
			display: flex; 
			align-items: center; 
			gap: 12px; 
			transition: all 0.2s ease; 
			font-size: 16px;
		}
		
		.sidebar-item:hover { 
			background: var(--sidebar-hover); 
			color: var(--text-primary);
		}
		
		.sidebar-item.active { 
			background: rgba(100, 105, 204, 0.15); 
			color: var(--color-brand);
			font-weight: 600; 
		}
		
		.sidebar-icon { 
			font-size: 18px; 
			width: 24px; 
			text-align: center; 
			opacity: 0.8;
		}

		.sidebar-item.active .sidebar-icon {
			opacity: 1;
		}
	`;
	document.head.appendChild(style);
}

// Auto inject styles khi file được load
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', injectSidebarStyles);
} else {
	injectSidebarStyles();
}
