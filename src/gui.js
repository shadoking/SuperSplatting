function InitGUI(settings) {
    const gui = new lil.GUI({title: 'Settings'});

    gui.add(settings, 'uploadFile').name('Upload .ply file');
    document.querySelector('#fileInput').addEventListener('change', async e => {
        if (e.target.files.length === 0) {
            return;
        }
        try {
            await LoadScene(e.target.files[0]);
        } catch (error) {
            document.querySelector('#loading-text').textContent = `An error occured when trying to read the file.`;
            throw error;
        }
    });

    gui.add(settings, 'sortTime').name('Sort Time').disable().listen();
    gui.add(settings, 'speed', 0.01, 2, 0.01).name('Camera Speed');   
}