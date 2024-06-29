//Define the variables that will be used in the script

//Create the variable for the database
let db;
let selectedDate;
let tasks;
let totalTasks = 0;

//Create the variables for the navbar
const restartBtn = document.querySelector("#restartDb");

//Create the variables for the calendar
const calendarDays = document.querySelectorAll(".todo__day");
const minDate = moment().subtract(2, 'days').format("YYYY-MM-DD");

//Create the variables for the to-do list
const todoPending = document.querySelector(".todo__pending");
const todoCompleted = document.querySelector(".todo__completed");
const filterSelect = document.querySelector("#filter");

//Create the variables for the actions and percents
const createTaskBtn = document.getElementById("addTask");
const checkAllBtn = document.getElementById("checkAll");
const uncheckAllBtn = document.getElementById("uncheckAll");
const deleteAllBtn = document.getElementById("deleteAll");
const completedTasksPercent = document.getElementById("completedPercent");
const completedTasksBar = document.querySelector(".actions__completed--green")
const pendingTasksPercent = document.getElementById("pendingPercent");
const pendingTasksBar = document.querySelector(".actions__completed--yellow")

//Modal
const modal = document.querySelector(".modal")
const modalTitle = document.querySelector(".modal__title")
const closeModalIcon = document.querySelector(".modal__icon");
const submitModalBtn = document.querySelector(".modal__button--submit")
const closeModalBtn = document.querySelector(".modal__button--cancel");
const modalForm = document.querySelector(".modal__form");
const taskNameInput = document.querySelector("#taskName");
const taskDescriptionInput = document.querySelector("#taskDescription");
const taskCategoryInput = document.querySelector("#taskCategory");
const taskDateInput = document.querySelector("#taskDate");
const modalError = document.querySelector(".modal__error");

window.addEventListener("DOMContentLoaded", () => {
    intializeCalendar();
    createDatabase();
    loadEventListeners();
})

function loadEventListeners() {
    //Events for the navbar
    restartBtn.addEventListener("click", restartDatabase);

    //Events for the calendar
    calendarDays.forEach(day => {
        day.addEventListener("click", selectDay);
    });

    //Events for the to-do list
    filterSelect.addEventListener("change", verifyFilter);

    //Events for the to-do list action
    checkAllBtn.addEventListener("click", () => { checkTasks("Sin completar", "Completada") });
    uncheckAllBtn.addEventListener("click", () => { checkTasks("Completada", "Sin completar") });
    deleteAllBtn.addEventListener("click", deleteAllTasks);

    //Events for the modal
    createTaskBtn.addEventListener("click", openModal);
    closeModalIcon.addEventListener("click", closeModal);
    closeModalBtn.addEventListener("click", closeModal);
    modal.addEventListener("keydown", closeModal);
    modalForm.addEventListener("submit", validateAction);
}

//*NAVBAR FUNCTIONS

async function restartDatabase(e) {
    userSelection = await showVerificationAlert("La base de datos será restablecida desde cero, ¿Estás seguro de tu decisión?", "Sí, deseo continuar");
    //If the user wants to delete the task we continue with the code
    if (userSelection) {
        try {
            const request = indexedDB.deleteDatabase("Taskie");            
            showAlert("¡Felicitaciones!", "La base de datos ha sido restaurada desde cero, en breves segundos serás redirigido de nuevo a la aplicación web", "success");
            setTimeout(() => { window.location.reload() }, 4000);
        } catch (error) {
            showAlert("Error", "Ha ocurrido un error a la hora de restaurar la base de datos", "error");
        }
    }
}

//*CALENDARY FUNCTIONS

//Function to initialize the calendar in the current date
function intializeCalendar() {
    //Traverse all the calendar elements and place the corresponding date with respect to the aria-add attribute
    const calendarItem = document.querySelectorAll('.todo__number');

    //Import the moment library to format the dates and set it in spanish
    moment.locale('es');

    //Initialize swiper with some parameters -> Initial slide: 2, slides per view: auto, navigation buttons
    const swiper = new Swiper(".swiper", {
        initialSlide: 2,
        slidesPerView: "auto",
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
    });

    calendarItem.forEach((day) => {
        //Get the number of days to add to the current date
        const addDays = parseInt(day.getAttribute("data-add"));
        //Get the current day and the weekday
        const currentDay = moment().add(addDays, 'days').format("DD");
        const ariaLabelDate = moment().add(addDays, 'days').format("LL");
        let weekDay = moment().add(addDays, 'days').format("dddd");
        //Capitalize the first letter of the weekday and obtain only the first three letters
        weekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1, 3);
        
        //Show the changes in the webpage
        day.innerHTML = currentDay;
        day.nextElementSibling.innerHTML = weekDay;
        //We change the aria-label attribute to improve the accessibility of the calendar
        day.parentElement.setAttribute("aria-label", "Botón para seleccionar un día de la semana a partir del cual se filtrarán las tareas: " + ariaLabelDate);
    })

    //Set the min attribute for the date input
    taskDateInput.setAttribute("min", minDate);
}

//Function to select a specific day in the calendar
function selectDay(e) {
    //Remove the current active element class
    document.querySelector(".todo__day--active").classList.remove("todo__day--active");

    //Add the active class to the selected day
    const selectedDay = (e.target.nodeName === "SPAN") ? e.target.parentElement : e.target;
    selectedDay.classList.add("todo__day--active");
    verifyFilter()
}

//*DATABASE FUNCTION

//Function to open indexed db
function createDatabase() {
    //First check the compatibility with the browser
    if (!('indexedDB' in window)) {
        Swal.fire({
            title: "Error",
            text: "Tu navegador no soporta IndexedDB, te recomendamos abrir el sitio desde otro navegador",
            icon: "error"
        });
        return;
    } else {
        //Open the database
        const request = window.indexedDB.open("Taskie", 1);
        //If the database is not created we create it
        request.onupgradeneeded = function (e) {
            db = e.target.result;
            const objectStore = db.createObjectStore("tasks", {
                keyPath: "id",
                autoIncrement: true
            });

            //Create the index for the each field of the task
            objectStore.createIndex("fecha", "fecha", { unique: false });
        }

        // If the database is opened successfully
        request.onsuccess = function(e) {
            db = e.target.result;
            deleteOldDates();
            loadTasks();
        };
    }
}

//Function to delete the tasks from the database that are older than the current date
function deleteOldDates() {
    const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
    const dateIndex = objectStore.index("fecha");
    //Use a range to obtain the old dates
    const queryDate = dateIndex.getAll(IDBKeyRange.upperBound(minDate));

    queryDate.onsuccess = function(e) {
        //Iterate based on the result and eliminate that task.
        const tasks = e.target.result;
        tasks.forEach(task => {
            objectStore.delete(task.id)
        });
    }
}

//*DOM FUNCTIONS

//Function to load the tasks from the database
function loadTasks(filter = null, filterValue = null) {
    //Obtain the active calendar day
    const selectedDay = document.querySelector(".todo__day--active").firstElementChild;
    const addDays = selectedDay.getAttribute("data-add");
    selectedDate = moment().add(addDays, 'days').format("YYYY-MM-DD");

    //Filter the tasks by the date
    const objectStore = db.transaction("tasks", "readonly").objectStore("tasks");
    const dateIndex = objectStore.index("fecha");
    const queryDate = dateIndex.getAll(selectedDate);

    queryDate.onsuccess = function(e) {
        tasks = filter ? e.target.result.filter((task) => task.categoria === filterValue): e.target.result;
        totalTasks = tasks.length;
        showTasks(tasks, "Sin completar", todoPending.firstElementChild);
        showTasks(tasks, "Completada", todoCompleted.firstElementChild);
    };
}

//Verify if the user has a filter applied and call the loadtasks function in one way or another
function verifyFilter() {
    //Verify if there is a filter applied
    if (filterSelect.value !== "") {
        loadTasks(true, filterSelect.value);   
    }else{
        loadTasks();
    }
}

//Function to show the tasks depending on the categorie and the state
function showTasks(tasks, state, container) {
    let counter = 0;
    const filteredTasks = tasks.filter((task) => task.estado === state);
    cleanList(container);
    filteredTasks.forEach(task => {
        createTaskItem(task, container);
        counter++;
    });
    showPercent(counter, state)
}

//Function to clean the list of tasks
function cleanList(list) {
    while (list.firstChild) {
        list.removeChild(list.firstChild);
    }
}

//Function to create a new task item in the DOM
function createTaskItem(task, container) {
    //Do destructuring of the task to obtain only the necessary fields
    const { nombre, descripcion, categoria, estado, id } = task;

    //Define an object with all the icons
    const taskIcons = {
        Personal: ["ri-user-fill", "blue"],
        Trabajo: ["ri-building-2-fill", "orange"],
        Hobby: ["ri-book-marked-fill", "purple"],
        Finanzas: ["ri-wallet-3-fill", "green"],
        Educación: ["ri-graduation-cap-fill", "yellow"],
        Hogar: ["ri-home-2-fill", "pink"],
        Social: ["ri-group-fill", "brown"],
        Proyectos: ["ri-article-fill", "red"]
    }

    let taskIcon = taskIcons[categoria][0];
    let taskColor = taskIcons[categoria][1];
    
    container.innerHTML += 
    `
        <li class="todo__item">
            <div class="todo__icon todo__icon--${taskColor}">
                <div class="todo__circle">
                    <i class="${taskIcon}"></i>
                </div>
            </div>
            <div class="todo__content">
                <h4 class="todo__title todo__title--list ${estado === "Completada"? "todo__title--strike" : ""}" aria-label="Nombre de la Tarea: ${nombre}" tabindex="0">${nombre}</h4>
                <p class="todo__paragraph ${estado === "Completada"? "todo__paragraph--strike" : ""}" aria-label="Descripción de la Tarea: ${descripcion}" tabindex="0">${descripcion}</p>
            </div>
            <div class="todo__actions">
                <input type="checkbox" class="todo__checkbox" name="checkbox" data-id="${id}" ${estado === "Completada"? "checked" : ""} aria-label="Estado de la Tarea" onchange="updateState(this)">
                <i class="ri-edit-2-fill todo__actions-icon todo__actions-icon--edit" data-id="${id}" aria-label="Editar Tarea" tabindex="0" onclick="changeModalAppearance(null, this)" onkeypress="changeModalAppearance(event, this)"></i>
                <i class="ri-close-circle-fill todo__actions-icon todo__actions-icon--delete" data-id="${id}" aria-label="Eliminar Tarea" tabindex="0" onclick="deleteTask(null, this)" onkeypress="deleteTask(event, this)"></i>
            </div>
        </li>
    `
}

function showPercent(counter, state) {
    const taskPercent = totalTasks !== 0 ? Math.round((counter / totalTasks) * 100) : 0;
    if (state === "Sin completar") {
        pendingTasksPercent.textContent = taskPercent + "%";
        pendingTasksBar.style.width = taskPercent + "%";
    } else if (state === "Completada") {
        completedTasksPercent.textContent = taskPercent + "%";
        completedTasksBar.style.width = taskPercent + "%";
    }
}

//*MODAL FUNCTIONS

//Function to create a new task and add it in the localstorage
function openModal() {
    modal.showModal();
    closeModalIcon.tabIndex = 1;
    closeModalIcon.focus();
}

//Function to close the modal
function closeModal(e = null) {
    if (e) { if (e.keyCode && e.keyCode !== 27) { return; } e.preventDefault(); }
    modal.setAttribute('closing', '');
    setTimeout(() => {
        modal.close();
        modal.removeAttribute('closing');
        modalError.classList.remove("modal__error-show");
        //We reset the form and the modal appearance
        modalForm.reset();
        if (modalForm.getAttribute("data-action") === "edit") { resetModalAppearance() }
    }, 1000); // Duración de la animación
}

//Function to change the modal appareance when the user wants to edit a task
function changeModalAppearance(key, e) {
    //*THIS IF IS ONLY FOR USERS USING THE KEYBOARD (TAB)
    //If the user presses a different key than enter, it will do nothing 
    if (key) { if (key.keyCode !== 13) { return; } }

    const taskId = parseInt(e.getAttribute("data-id"));
    //Change the modal content
    modalTitle.textContent = "Editar Tarea";
    submitModalBtn.textContent = "Guardar Cambios";
    modalForm.setAttribute("data-action", "edit");
    modalForm.setAttribute("data-id", taskId);
    modalError.classList.remove("modal__error-show");

    //Search the selected thask
    const objectStore = db.transaction("tasks", "readonly").objectStore("tasks");
    const requestTask = objectStore.get(taskId);

    requestTask.onsuccess = function(e) {
        //Set the input values
        const task = e.target.result;

        //Verify the information was gathered
        if (!task) {
            showAlert("Error", "Ha ocurrido un error al recopilar los datos para la tarea seleccionada", "error");
            closeModal();
        }

        taskNameInput.value = task.nombre;
        taskDescriptionInput.value = task.descripcion;
        taskCategoryInput.value = task.categoria;
        taskDateInput.value = task.fecha;
        openModal();
    };

    requestTask.onerror = function(e){
        showAlert("Error", "Ha ocurrido un error al recopilar los datos para la tarea seleccionada", "error");
    }
}

//Function to reset the modal appearance
function resetModalAppearance() {
    //Change the modal content
    modalTitle.textContent = "Crear Tarea";
    submitModalBtn.textContent = "Crear Cambios";
    modalForm.setAttribute("data-action", "add");
    modalForm.removeAttribute("data-id");
    modalError.classList.remove("modal__error-show");
}

//* INDEXED DB CRUD

//Function to validate the action when user submit the form
function validateAction(e) {
    e.preventDefault();
    const action = e.target.getAttribute("data-action")
    if (action === "add") {
        createTask()
    }else if(action === "edit"){
        editTask(parseInt(e.target.getAttribute("data-id")));
    }else{
        showAlert("Error", "Ha ocurrido un error a la hora de enviar el formulario", "error")
    }
}

//Function to show a alert
function showAlert(title, text, icon) {
    Swal.fire({
        title: title,
        text: text,
        icon: icon
    });
}

//Function to show a alert when the modal is open
function showModalAlert(title, text, icon) {
    closeModal();
    setTimeout(() => {
        showAlert(title, text, icon);
    }, 1000);
}

//Function for when deleting a task, select all... show verification alert
function showVerificationAlert(text, button) {
    return Swal.fire({
        title: "¿Estás Seguro?",
        text: text,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: button,
        cancelButtonText: "Cancelar"
    }).then((result) => {
        return result.isConfirmed;
    });
}

//Function to create a new task and add it in the Indexed DB Storage

function createTask() {
    const data = validForm();

    //Create a task object
    const task = {
        nombre: data[0],
        descripcion: data[1],
        categoria: data[2],
        fecha: data[3],
        estado: "Sin completar"
    }

    //Get the object store using the existing database reference
    const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
    const addRequest = objectStore.add(task);

    addRequest.onsuccess = function (e) {
        closeModal();
        showModalAlert("Tarea creada", "La tarea ha sido creada correctamente", "success");
        verifyFilter();
    }

    addRequest.onerror = function (e) {
        showModalAlert("Error", "Ha ocurrido un error a la hora de crear la tarea", "error");
    }
}

//Function to check that all fields have been filled out
function validForm() {
    const taskName = taskNameInput.value;
    const taskDescription = taskDescriptionInput.value;
    const taskCategory = taskCategoryInput.value;
    const taskDate = taskDateInput.value;

    if (!taskName ||!taskDescription ||!taskCategory ||!taskDate) {
        modalError.classList.add("modal__error-show");
        return;
    }

    return [taskName, taskDescription, taskCategory, taskDate];
}

//Function to delete a specific task
//*Async is used to declare an asynchronous function.
async function deleteTask(key, e) {
    //*THIS IF IS ONLY FOR USERS USING THE KEYBOARD (TAB)
    //If the user presses a different key than enter, it will do nothing
    if (key) { if (key.keyCode !== 13) { return; } }

    //*Await is used to wait for a promise to be resolved. It pauses the execution of the asynchronous function and waits for the resolution of the promise.
    userSelection = await showVerificationAlert("La tarea seleccionada será eliminada, ¿Estás seguro de tu decisión?", "Sí, deseo eliminar");
    //If the user wants to delete the task we continue with the code
    if (userSelection) {
        const taskId = parseInt(e.getAttribute("data-id"));
        const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
        
        //*Call object store without event handlers and change it to try catch because we are in an await function and it is handled with promises.
        try {
            await objectStore.delete(taskId);
            showAlert("Tarea eliminada", "La tarea ha sido eliminada correctamente", "success");
            verifyFilter();
        } catch (error) {
            showAlert("Error", "Ha ocurrido un error a la hora de eliminar la tarea", "error");
        }
    }
}

//Function to edit a task
function editTask(id) {
    const data = validForm();
    const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
    //Retrieve existing record
    const getRequest = objectStore.get(id);

    getRequest.onsuccess = function(e){
        const existingRecord = e.target.result;

        if (existingRecord) {
            existingRecord.nombre = data[0];
            existingRecord.descripcion = data[1];
            existingRecord.categoria = data[2];
            existingRecord.fecha = data[3];

            const updateRequest = objectStore.put(existingRecord);

            updateRequest.onsuccess = function() {
                showModalAlert("Tarea editada", "La tarea ha sido actualizada correctamente", "success");
                verifyFilter();
            };
    
            updateRequest.onerror = function() {
                showModalAlert("Error", "Ha ocurrido un error a la hora de editar la tarea", "error");
            };
        }else{
            showModalAlert("Error", "Ha ocurrido un error a la hora de editar la tarea", "error");
        }
    }
}

//Function to update the state of the task
function updateState(e) {
    const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
    const getRequest = objectStore.get(parseInt(e.getAttribute("data-id")));
    const newState = (e.checked) ? "Completada" : "Sin completar";

    getRequest.onsuccess = function(e){
        const existingRecord = e.target.result;

        if (existingRecord) {
            existingRecord.estado = newState;
            const updateRequest = objectStore.put(existingRecord);

            updateRequest.onsuccess = function() {
                showAlert("Estado actualizado", "El estado de la tarea ha sido actualizado correctamente", "success");
            };
            updateRequest.onerror = function() {
                showAlert("Error", "Ha ocurrido un error a la hora de actualizar el estado de la tarea", "error");
            };
        }else{
            showAlert("Error", "Ha ocurrido un error a la hora de obtener la tarea con la ID suministrada", "error");
        }

        verifyFilter();
    }
}

//Funcion para marcar o desmarcar todas las tareas para un día en específico

async function checkTasks(previousState, newState) {
    userSelection = await showVerificationAlert(`Todas las tareas para el día seleccionado serán marcadas como "${newState}", ¿Estás seguro de tu decisión?`, "Sí, deseo continuar");

    if (userSelection) {
        const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
        //Filter the tasks to check/uncheck
        const tasksToMark = tasks.filter(task => task.estado === previousState);

        //Verify if all the tasks are checked/unchecked
        if (tasksToMark.length === 0) {
            showAlert("¡Información!", `Todas las tareas están marcadas como "${newState}" o no existe ninguna tarea para el día seleccionado`, "info");
            return;
        }

        //Iterates the tasksToMark array
        tasksToMark.forEach(task => {
            //We update the task state
            task.estado = newState;
            const updateRequest = objectStore.put(task);

            updateRequest.onerror = function() {
                showAlert("Error", "Ha ocurrido un error a la hora de actualizar el estado de todas las tareas", "error");
                return
            };
        });

        showAlert("¡Felicitaciones!", `Todas las tareas han sido marcadas como "${newState}"`, "success");
        verifyFilter();
    }
}

async function deleteAllTasks() {
    userSelection = await showVerificationAlert(`Todas las tareas para el día seleccionado serán eliminadas, ¿Estás seguro de tu decisión?`, "Sí, deseo continuar");

    if (userSelection) {
        //Filter the tasks by the date
        const objectStore = db.transaction("tasks", "readwrite").objectStore("tasks");
        //Verify if tasks is not empty
        if (tasks.length === 0) {
            showAlert("¡Alerta!", `No hay tareas para el día seleccionado`, "info");
            return;
        }

        //Iterates the tasks array
        tasks.forEach(task => {
            //We delete the task
            const deleteRequest = objectStore.delete(task.id);

            deleteRequest.onerror = function() {
                showAlert("Error", "Ha ocurrido un error a la hora de eliminar todas las tareas", "error");
                return
            };
        });

        showAlert("¡Felicitaciones!", `Todas las tareas han sido eliminadas correctamente`, "success");
        verifyFilter();
    }
}