// Function to set the title
function setTitle() {
    var title = document.getElementById('title').value;
    localStorage.setItem('title', title);
    document.title = title;
}

// Function to set the icon
function setIcon() {
    var icon = document.getElementById('icon').value;
    localStorage.setItem('icon', icon);
    setIcoLink(icon);
}

// Function to reset title and icon
function reset() {
    localStorage.removeItem('title');
    localStorage.removeItem('icon');
    setIcoLink('favicon.png');
    document.title = 'Tasks - Cranmore VLE - Oracle';
}

// Function to set the icon link
function setIcoLink(linkIcon) {
    var link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = linkIcon;
}

// Event listener for setting title
var btnTitle = document.getElementById("btnTitle");
btnTitle.addEventListener("click", setTitle);

// Event listener for setting icon
var btnIcon = document.getElementById("btnIcon");
btnIcon.addEventListener("click", setIcon);

// Event listener for resetting
var btnReset = document.getElementById("btnReset");
btnReset.addEventListener("click", reset);

// Restore saved title/icon on page load
(function () {
    var savedTitle = localStorage.getItem('title');
    var savedIcon  = localStorage.getItem('icon');
    if (savedTitle) document.title = savedTitle;
    if (savedIcon)  setIcoLink(savedIcon);
})();
