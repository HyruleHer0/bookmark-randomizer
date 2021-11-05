/// <reference path="chrome.d.ts" />

function main() {
    /** Key for chrome's local storage for saved sets */
    const setsStorageKey = "saved-sets";
    /** Key for chrome's local storage for logs */
    const logStorageKey = "logs";
    /** Max number of logged actions to keep */
    const maxLogs = 100;
    /** Max characters allowed as a set name */
    const maxSetName = 40;
    /** Names that the user cannot use to name a set */
    const reservedSetNames = ['Create New', 'Random-All'];
    /** Dictionary of set name to array bookmark folder ids */
    var allSets;
    /** { name: string, ids: string[] } - The new set being created, or the existing set being edited. */
    var currentSet;
    /** The current chrome bookmarks node being viewed. */
    var currentNode;

    // Elements
    const $setsArea = document.querySelector('#sets-area');
    const $createNewElem = $setsArea.querySelector('.create-new-set');
    const $bookmarksList = document.querySelector('#bookmarks-area .bookmarks-list');
    const $bookmarkNav = document.querySelector('#bookmarks-area .navigation-area');
    const $selectedFolders = $bookmarkNav.querySelector('.folder-count');
    const $headerElem = document.querySelector('header');
    const $newSetNameInput = $headerElem.querySelector('.new-set-name');
    const $saveSetBtn = $headerElem.querySelector('i.fa-save');

    assignHandlers();
    chrome.storage.sync.get(setsStorageKey, buildSetsList);

    /** Populates the list of sets on the page given the response from chrome.storage */
    function buildSetsList(storageRsp) {
        allSets = storageRsp[setsStorageKey] || {};

        clearSetsList();
        Object.keys(allSets).forEach(key => {
            const setElem = buildHTMLForSet(key);
            $setsArea.insertBefore(setElem, $createNewElem);
        });
    }

    /** Empty the list of sets on the page */
    function clearSetsList() {
        while ($setsArea.firstChild !== $createNewElem) {
            $setsArea.removeChild($setsArea.firstChild);
        }
    }

    /** Sets the new active folder and displays its subfolders */
    function setActiveFolder(node) {
        if (!!node.children & !!node.children.length) {
            currentNode = node;
            
            $bookmarkNav.classList.toggle('at-root', !node.hasOwnProperty('parentId'));
            const currentFolderElem = $bookmarkNav.querySelector(".current-folder");
            currentFolderElem.innerText = `Viewing Folder: ${node.parentId ? node.title : 'Root'}`;

            clearBookmarkFolders();
            node.children.forEach(child => {
                if (isAFolder(child)) {
                    const bookmarkElem = buildHTMLForFolder(child);
                    $bookmarksList.append(bookmarkElem);
                }
            });
        }
    }

    /** Empties the list of folders on the page */
    function clearBookmarkFolders() {
        while ($bookmarksList.children.length > 0) {
            $bookmarksList.removeChild($bookmarksList.firstChild);
        }
    }

    /** Sets the active folder given its id and displays its subfolders */
    function setActiveFolderById(id) {
        chrome.bookmarks.getSubTree(id, result => {
            if (!!result && result.length) {
                setActiveFolder(result[0]);
            }
        });
    }

    /** Builds the HTML for a set in the list */
    function buildHTMLForSet(setName) {
            const setElem = document.createElement('div');
            setElem.classList.add('set-item');
            setElem.dataset.setName = setName;

            const setNameElem = document.createElement('span');
            setNameElem.innerText = setName;

            const editBtn = document.createElement('i');
            editBtn.classList.add('fas', 'fa-wrench');
            editBtn.title = 'Edit';

            const delBtn = document.createElement('i');
            delBtn.classList.add('fas', 'fa-trash-alt');
            delBtn.title = 'Delete';

            const btnContainer = document.createElement('span');
            btnContainer.classList.add('buttons');

            btnContainer.append(editBtn, delBtn);
            setElem.append(setNameElem, btnContainer);
            return setElem;
    }

    /** Builds the HTML for a folder in the list */
    function buildHTMLForFolder(node) {
        // Count the number of bookmark and folder children for the node
        let bmCount = 0, folderCount = 0;
        node.children.forEach(grandchild => {
            if (!isAFolder(grandchild)) {
                bmCount++;
            }
            else {
                folderCount++;
            }
        });

        const folderElem = document.createElement('div');
        folderElem.dataset.id = node.id;
        folderElem.dataset.folders = folderCount;
        folderElem.classList.add('bookmark-folder');

        if (currentSet.ids.indexOf(node.id) > -1) {
            folderElem.classList.add('selected');
        }

        const folderNameElem = document.createElement('span');
        folderNameElem.innerText = node.title;

        const btnContainer = document.createElement('span');
        btnContainer.classList.add('buttons');

        const childInfoElem = document.createElement('div');
        childInfoElem.classList.add('child-info');
        childInfoElem.title = `${folderCount} Folders / ${bmCount} Bookmarks`;

        const folderCountElem = document.createElement('div');
        folderCountElem.innerHTML = `<div>${folderCount} <i class="fas fa-folder"></i></div>`;

        const bmCountElem = document.createElement('div');
        bmCountElem.innerHTML = `<div>${bmCount} <i class="fas fa-bookmark"></i></div>`;

        childInfoElem.append(folderCountElem, bmCountElem);
        btnContainer.append(childInfoElem);

        const stepDownElem = document.createElement('i');
        stepDownElem.classList.add('fas', 'fa-level-down-alt');
        stepDownElem.title = "View subfolders";
        btnContainer.appendChild(stepDownElem);

        if (folderCount === 0) {
            stepDownElem.classList.add('disabled');
        }

        folderElem.append(folderNameElem, btnContainer);
        return folderElem;
    }

    /** Opens the set editor to create or edit the folders within a set
     * @param setName The name of the set to edit. If omitted, this is a new set
     */
    function openSetEditor(setName) {
        if (!!setName) {
            currentSet = {name: setName, ids: allSets[setName]};
            setHeaderStatus(true, setName);
        }
        else {
            currentSet = {name: '', ids: []};
            setHeaderStatus(true, '');
        }

        displayFolderCount();

        chrome.bookmarks.getTree(result => {
            setActiveFolder(result[0]);
            $setsArea.classList.add('hide');
        });
    }

    /** Close the set editor and return to the list of sets */
    function closeSetEditor() {
        setHeaderStatus(false, '');

        currentSet = undefined;
        $newSetNameInput.value = '';

        chrome.storage.sync.get(setsStorageKey, (response) => {
            buildSetsList(response);
            $setsArea.classList.remove('hide');
        });
    }

    /** Modify the header as needed for the current state of the app.
     * @param isEditingOrCreating If the set editor pane being opened, else it is being closed
     * @param setName The name of the set to edit. If omitted, this is a new set
    */
    function setHeaderStatus(isEditingOrCreating, setName) {
        const statusArea = $headerElem.querySelector(".status-area");

        if (isEditingOrCreating) {
            if (!!setName) {
                statusArea.classList.add('is-editing');
                const statusTextElem = $headerElem.querySelector(".status-text");
                statusTextElem.innerText = 'Editing ';
                const setNameElem = document.createElement("span");
                setNameElem.classList.add('emphasis');
                setNameElem.innerText = setName;
                statusTextElem.appendChild(setNameElem);
            }
            else {
                statusArea.classList.add('is-creating');
                $newSetNameInput.classList.add('invalid-input');
            }

            giveSaveBtnFeedback();
        }
        else {
            statusArea.classList.remove('is-creating', 'is-editing');
            $headerElem.querySelector(".status-text").textContent = 'Viewing Saved Sets';
        }    
    }

    /** Modify the display of selected folder count */
    function displayFolderCount() {
        $selectedFolders.innerText = `${currentSet.ids.length} Folders Selected`;
        $selectedFolders.classList.toggle('none-selected', currentSet.ids.length === 0);
    }

    /** Delete a set from the list and from chrome.storage
     * @param setName The name of the set
     */
    function deleteSet(setName) {
        delete allSets[setName];
        chrome.storage.sync.set({[setsStorageKey]: allSets}, () => {
            chrome.storage.sync.get(setsStorageKey, buildSetsList);
        });
    }

    /** Delegated event handler for clicking on a set in the list */
    function clickSet(e) {
        const set = e.target.closest('.set-item');
        const btn = e.target.closest('i');

        if (!set) {
            return;
        }

        if (!!btn) {
            switch (btn.title) {
                case 'Edit':
                    openSetEditor(set.dataset.setName);
                    break;
                case 'Delete':
                    deleteSet(set.dataset.setName);
                    break;
            }
        }
        else {
            if (set.classList.contains('create-new-set')) {
                openSetEditor('');
            }
            else if (set.classList.contains('random-all')) {
                goToRandomFromAllBookmarks();
            }
            else {
                goToRandomURLFromSet(set.innerText);
            }
        }
    }

    /** Delegated event handler for clicking a folder in the list */
    function clickFolder(e) {
        const folder = e.target.closest('.bookmark-folder');
        const subFolderBtn = e.target.closest('i.fa-level-down-alt');

        if (!folder) {
            return;
        }

        if (!!subFolderBtn) {
            if (parseInt(folder.dataset.folders) > 0) {
                setActiveFolderById(folder.dataset.id);
            }
        }
        else {    
            toggleFolderSelection(folder);
        }
    }

    /** Select or deselect a folder from the list
     * @param folderElement The HTML element of the folder that was clicked on
     */
    function toggleFolderSelection(folderElement) {
        const index = currentSet.ids.indexOf(folderElement.dataset.id);

        if (index > -1) {
            currentSet.ids.splice(index, 1);
        }
        else {
            currentSet.ids.push(folderElement.dataset.id);
        }

        displayFolderCount();
        giveSaveBtnFeedback();
        folderElement.classList.toggle('selected', index === -1);
    }

    /** Validate that the set name is not too long and does not already exist
     * @param value The set name
     */
    function validateSetNameInput(value) {
        return !!value && value.length < maxSetName && value in allSets === false && reservedSetNames.indexOf(value) === -1;
    }

    /** Delegated event handler for clicking the header */
    function clickHeader(e) {
        const btn = e.target.closest('i');
        if (!!btn) {
            if (btn.classList.contains('fa-save') && currentSet.ids.length > 0) {
                saveCurrentSet();
            }
            else if (btn.classList.contains('fa-window-close')) {
                closeSetEditor();
            }
        }
    }

    /** Save the new set or save the changes to the set being edited */
    function saveCurrentSet() {
        if (!currentSet.name) {
            const inputValue = $headerElem.querySelector('.new-set-name').value;
            
            if (!validateSetNameInput(inputValue) || currentSet.ids.length === 0) {
                return;
            }

            currentSet.name = inputValue;
        }

        allSets[currentSet.name] = currentSet.ids;
        chrome.storage.sync.set({[setsStorageKey]: allSets}, () => {
            closeSetEditor();
        });
    }

    /** Delegated event handler for clicking the bookmark navigation area */
    function clickNavArea(e) {
        const btn = e.target.closest('.fa-level-up-alt');
        if (!!btn) {
            setActiveFolderById(currentNode.parentId);
        }
    }

    /** Assign handlers to select elements */
    function assignHandlers() {
        $setsArea.addEventListener('click', clickSet);
        $bookmarksList.addEventListener('click', clickFolder);
        $bookmarkNav.addEventListener('click', clickNavArea);
        $headerElem.addEventListener('click', clickHeader);
        $newSetNameInput.addEventListener('input', onInputChanged);
    }

    /** Event handler for the set name input */
    function onInputChanged(e) {
        e.target.classList.toggle('invalid-input', !validateSetNameInput(e.target.value));
        giveSaveBtnFeedback();
    }

    /** Change the hover functionality for the save button depending on if the current settings are valid */
    function giveSaveBtnFeedback() {
        if ($newSetNameInput.classList.contains('invalid-input')) {
            $saveSetBtn.classList.add('invalid');
            $saveSetBtn.title = 'Invalid Set Name';
        }
        else if (currentSet.ids.length === 0) {
            $saveSetBtn.classList.add('invalid');
            $saveSetBtn.title = 'No folders selected';
        }
        else {
            $saveSetBtn.classList.remove('invalid');
            $saveSetBtn.title = 'Save';
        }
    }

    /** Select and navigate to a random bookmark from within the set
     * @param setName The name of the set
     */
    function goToRandomURLFromSet(setName) {
        folderIds = allSets[setName];
        const promises = [];
        let allNodes = [];

        folderIds.forEach(id => {
            const promise = chrome.bookmarks.getChildren(id);
            promise
            .then((n) => allNodes = allNodes.concat(n))
            .catch(err => console.error(err)); // An invalid id throws an error that must be caught here
            promises.push(promise);
        });

        Promise.all(promises).finally(() => {
            const bookmarks = allNodes.filter(n => !isAFolder(n));
            if (bookmarks.length > 0) {
                const randomIndex = Math.floor(Math.random() * bookmarks.length);
                const randomURL = bookmarks[randomIndex].url;
                chrome.tabs.create({url: randomURL});
            }
        });
    }

    /** Select and navigate to a random bookmark from within all of the user's bookmarks */
    function goToRandomFromAllBookmarks() {
        let bookmarks = [];
        let folderStack = [];
        chrome.bookmarks.getTree(result => {
            let node = result[0];

            separateFoldersAndBookmarks(node, bookmarks, folderStack);
            while (folderStack.length > 0) {
                node = folderStack.pop();
                separateFoldersAndBookmarks(node, bookmarks, folderStack);
            }

            if (bookmarks.length > 0) {
                const randomIndex = Math.floor(Math.random() * bookmarks.length);
                const randomURL = bookmarks[randomIndex].url;
                chrome.tabs.create({url: randomURL});
            }
        });
    }

    /** Given a node and two arrays, splits the bookmarks into one array, and the folders into the other.
     * @param node The chrome.bookmarks node
     * @param bookmarks The array to put the bookmarks into
     * @param folders The array to put the folders into
    */
    function separateFoldersAndBookmarks(node, bookmarks, folders) {
        node.children.forEach(c => {
            if (isAFolder(c)) {
                folders.push(c);
            }
            else {
                bookmarks.push(c);
            }
        });
    }

    /** Checks if a chrome.bookmarks node is a folder. Otherwise, it is a bookmark
     * @param node The chrome.bookmarks node to check
     */
    function isAFolder(node) {
        return !node.hasOwnProperty('url');
    }
}
main();
