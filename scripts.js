// Function to authenticate using KeyAuth
function authenticateKeyAuth(key) {
    const keyAuth = new KeyAuthApp(
        "00", // Application Name
        "8DC21M410X", // Owner ID
        "298697a312e8bf6be4b184aa68953323e3c36f2deb0d49d0459e842a2eb29730", // Application Secret
        "1.0", // Application Version
    );

    keyAuth.verify(key)
        .then(response => {
            if (response.status === 'success') {
                // Key is valid, redirect to games.html
                window.location.href = "games.html";
            } else {
                // Key is invalid, display error message
                document.getElementById("error-msg").style.display = "block";
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Function to handle authentication button click
function authenticate() {
    // Get the entered key
    var enteredKey = document.getElementById("key-input").value.trim();
    
    // Authenticate using KeyAuth
    authenticateKeyAuth(enteredKey);
}

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
    document.title = 'VLE Login';
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
