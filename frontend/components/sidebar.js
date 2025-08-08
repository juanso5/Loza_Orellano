document.addEventListener('DOMContentLoaded', function () {
    const sidebarContainer = document.getElementById('sidebar-container');
    fetch('sidebar.html')
        .then(response => response.text())
        .then(data => {
            sidebarContainer.innerHTML = data;

            // Funcionalidad de colapsar la sidebar
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.querySelector('.main-content');

            if (sidebar && mainContent) {
                // Por defecto la tenés colapsada: mantenelo
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');

                // Disparamos un resize unos ms después para que FullCalendar recalcule
                setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
            }

            const toggleBtn = document.getElementById('sidebar-toggle');
            if (toggleBtn){
                toggleBtn.addEventListener('click', function () {
                    sidebar.classList.toggle('collapsed');
                    mainContent.classList.toggle('expanded');

                    // Dejamos que el DOM/paint termine y forzamos un resize para FullCalendar
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
                });
            }
        })
        .catch(error => console.error('Error al cargar la sidebar:', error));
});
