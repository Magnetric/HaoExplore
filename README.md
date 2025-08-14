# Light&Lens Website

A modern, responsive photography website to showcase your photos organized by year and location.

## 📁 Project Structure

```
photography-website/
├── index.html              # Main website homepage
├── gallery.html            # Individual photo pages
├── css/
│   └── styles.css         # All CSS styles
├── js/
│   ├── script.js          # Main website functionality
│   └── gallery-script.js  # Individual photo page functionality
├── admin/
│   ├── admin.html         # Admin interface for managing photos
│   └── admin-script.js    # Admin functionality
└── docs/
    ├── README.md          # Main documentation
    └── ADMIN_README.md    # Admin documentation
```

## 🚀 Quick Start

1. **View the Website**: Open `index.html` in your browser
2. **Manage Photos**: Open `admin/admin.html` to upload and manage photos
3. **View Documentation**: Check the `docs/` folder for detailed guides

## ✨ Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Photo Gallery**: Beautiful grid layout with hover effects
- **Year-Location Filtering**: Filter photos by year and/or location
- **Individual Photo Pages**: Click any photo to view it on a dedicated page with details
- **Social Media Links**: Connect with visitors through social media platforms
- **Admin Interface**: Private admin page for uploading and managing photos
- **Tags System**: Organize photos with custom tags
- **Modern UI**: Clean, professional design with smooth animations
- **Mobile Navigation**: Hamburger menu for mobile devices
- **Smooth Scrolling**: Smooth navigation between sections
- **Keyboard Navigation**: Use arrow keys for navigation on photo pages

## 📖 Documentation

- **Main Documentation**: See `docs/README.md` for detailed usage instructions
- **Admin Documentation**: See `docs/ADMIN_README.md` for admin interface guide

## 🛠️ File Organization

### Root Files
- `index.html` - Main website homepage
- `gallery.html` - Template for individual photo pages

### CSS Files (`css/`)
- `styles.css` - All website styling including responsive design

### JavaScript Files (`js/`)
- `script.js` - Main website functionality (gallery, filters, navigation)
- `gallery-script.js` - Individual photo page functionality

### Admin Files (`admin/`)
- `admin.html` - Private admin interface for managing photos
- `admin-script.js` - Admin functionality (upload, edit, delete)

### Documentation (`docs/`)
- `README.md` - Complete project documentation
- `ADMIN_README.md` - Admin interface documentation

## 🎯 Getting Started

### For Visitors
1. Open `index.html` in your web browser
2. Browse the photo gallery
3. Use filters to find specific photos
4. Click on photos to view details

### For Administrators
1. Open `admin/admin.html` in your web browser
2. Upload new photos with the upload form
3. Manage existing photos in the manage tab
4. Add tags to organize your collection

## 🔧 Customization

### Adding Your Photos
1. Open `admin/admin.html`
2. Use the upload form to add photos
3. Fill in title, location, year, and description
4. Add tags for organization
5. Photos automatically appear on the main site

### Modifying Styles
- Edit `css/styles.css` to change colors, fonts, and layout
- All styles are well-organized with comments

### Changing Functionality
- Edit `js/script.js` for main website features
- Edit `js/gallery-script.js` for individual photo pages
- Edit `admin/admin-script.js` for admin functionality

## 🌐 Deployment

### Local Development
Simply open `index.html` in your browser or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

### Web Hosting
Upload all files maintaining the folder structure:
- Upload all files and folders to your web hosting provider
- Ensure the folder structure is preserved
- The website will work immediately

### GitHub Pages
1. Create a GitHub repository
2. Upload all files maintaining the structure
3. Enable GitHub Pages in repository settings
4. Your site will be available at `https://username.github.io/repository-name`

## 📱 Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🎨 Design Features

- **Modern UI**: Clean, professional design
- **Responsive**: Works on all screen sizes
- **Smooth Animations**: Professional transitions
- **Glassmorphism Effects**: Modern visual elements
- **Accessibility**: Keyboard navigation and screen reader support

## 🔒 Security Note

The admin interface is not password-protected. To keep it private:
- Don't share the `admin/admin.html` file
- Consider adding basic authentication
- Keep the admin folder private

## 📞 Support

If you need help:
1. Check the documentation in `docs/`
2. Verify file paths are correct
3. Check browser console for errors
4. Ensure all files are in the correct folders

## 📄 License

This project is open source and available under the MIT License. 