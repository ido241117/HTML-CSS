# Personal Hub

Trang  dashboard cá nhân xây dựng để học lập trình HTML CSS js thuần.

## Features

| Page | Description |
|---|---|
| Dashboard | Trang chứa shortcut đến những link thường dùng đến có thể thêm xóa sửa, phân biệt link web và đường dẫn thư mục |
| Diary | Cố sao chép giao diện tường cá nhân của Facebook |
| Finance | Trang theo dõi thu chi cơ bản |
| Books | List sách đang đọc, đến trang nào, thêm bìa cho sách |
| YouTube | Dùng youtube API v3 để lấy giao diện |
| Music | Trang chơi nhạc, quét thư mục mp3 offline hơn 500 file, meta data lưu vào mongodb chỉ đọc file khi bấm vào chạy nhạc |
| Calendar | Trang lịch, quản lý task, event, sinh nhật |
| Settings | Một số tùy chỉnh cho toàn bộ app |

## Tech Stack

**Frontend**

- Vanilla HTML, CSS, JavaScript
- Dùng cùng CSS cho toàn các trang bằng file common.css
- Responsive sidebar layout để ẩn đi trên điện thoại khi cần

**Backend**

- Node.js + Express
- Multer để upload ảnh, Sharp để cache ảnh với size nhỏ hơn
- music-metadata để đọc audio tag .mp3 cho tính năng nhạc

**Storage**

- JSON files (primary data store)
- MongoDB (metadata musiclist)

## Project Structure

```
code/
├── frontend/          # All HTML pages + shared CSS/JS
│   ├── common.css     # Global styles & CSS variables
│   ├── sidebar.js     # Shared sidebar component
│   └── *.html         # One file per feature page
└── backend/
    ├── server.js      # Express app entry point
    ├── routes/        # API routes per feature
    ├── middleware/     # Upload handling
    └── utils/         # Shared helpers
```

## Notes

Trang web tự build để chạy localhost, tự học HTML CSS js cho frontend và node.js cho backend
