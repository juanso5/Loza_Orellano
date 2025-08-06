document.addEventListener('DOMContentLoaded', function () {
    const app = document.getElementById('app');
    const menuLinks = document.querySelectorAll('.sidebar ul li a');

    // Función para cargar un componente dinámicamente
    function loadComponent(component) {
        fetch(`${component}.html`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error al cargar ${component}.html`);
                }
                return response.text();
            })
            .then(html => {
                app.innerHTML = html;
            })
            .catch(error => {
                app.innerHTML = `<p>Error: ${error.message}</p>`;
            });
    }

    // Listener para los enlaces del menú
    menuLinks.forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            const component = this.getAttribute('data-component');
            loadComponent(component);
        });
    });

    // Cargar el componente por defecto (home) al iniciar
    loadComponent('home');
});