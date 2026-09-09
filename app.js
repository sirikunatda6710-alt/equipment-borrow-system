document.addEventListener("DOMContentLoaded", function () {
/* ========================================
   ตั้งรหัสผ่านใหม่
======================================== */

const forgotPasswordForm =
    document.getElementById("forgotPasswordForm");


if (forgotPasswordForm) {

    const toggleNewPassword =
        document.getElementById("toggleNewPassword");

    const newPassword =
        document.getElementById("newPassword");


    const toggleConfirmNewPassword =
        document.getElementById("toggleConfirmNewPassword");

    const confirmNewPassword =
        document.getElementById("confirmNewPassword");


    // ========================================
    // แสดง / ซ่อน รหัสผ่านใหม่
    // ========================================

    if (toggleNewPassword && newPassword) {

        toggleNewPassword.addEventListener(
            "click",
            function () {

                if (newPassword.type === "password") {

                    newPassword.type = "text";

                    toggleNewPassword.textContent =
                        "ซ่อน";

                } else {

                    newPassword.type = "password";

                    toggleNewPassword.textContent =
                        "แสดง";

                }

            }
        );

    }


    // ========================================
    // แสดง / ซ่อน ยืนยันรหัสผ่านใหม่
    // ========================================

    if (
        toggleConfirmNewPassword &&
        confirmNewPassword
    ) {

        toggleConfirmNewPassword.addEventListener(
            "click",
            function () {

                if (
                    confirmNewPassword.type ===
                    "password"
                ) {

                    confirmNewPassword.type =
                        "text";

                    toggleConfirmNewPassword.textContent =
                        "ซ่อน";

                } else {

                    confirmNewPassword.type =
                        "password";

                    toggleConfirmNewPassword.textContent =
                        "แสดง";

                }

            }
        );

    }


    // ========================================
    // กดตั้งรหัสผ่านใหม่
    // ========================================

    forgotPasswordForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const email =
                document.getElementById(
                    "forgotEmail"
                ).value.trim();


            const newPasswordValue =
                newPassword.value;


            const confirmPasswordValue =
                confirmNewPassword.value;


            // ดึงข้อมูลสมาชิก

            let users =
                JSON.parse(
                    localStorage.getItem(
                        "equipment_users"
                    )
                ) || [];


            // ค้นหาผู้ใช้จากอีเมล

            const userIndex =
                users.findIndex(
                    function (user) {

                        return (
                            user.email.toLowerCase() ===
                            email.toLowerCase()
                        );

                    }
                );


            // ไม่พบอีเมล

            if (userIndex === -1) {

                alert(
                    "ไม่พบอีเมลนี้ในระบบ"
                );

                return;

            }


            // ========================================
            // ตรวจสอบรหัสผ่าน
            // ========================================

            if (
                newPasswordValue.length < 8
            ) {

                alert(
                    "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
                );

                return;

            }


            if (
                !/[A-Z]/.test(
                    newPasswordValue
                )
            ) {

                alert(
                    "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่อย่างน้อย 1 ตัว"
                );

                return;

            }


            if (
                !/[a-z]/.test(
                    newPasswordValue
                )
            ) {

                alert(
                    "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็กอย่างน้อย 1 ตัว"
                );

                return;

            }


            if (
                !/[0-9]/.test(
                    newPasswordValue
                )
            ) {

                alert(
                    "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"
                );

                return;

            }


            // ตรวจสอบว่ารหัสผ่านตรงกัน

            if (
                newPasswordValue !==
                confirmPasswordValue
            ) {

                alert(
                    "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน"
                );

                return;

            }


            // ========================================
            // เปลี่ยนรหัสผ่าน
            // ========================================

            users[userIndex].password =
                newPasswordValue;


            // บันทึกข้อมูลใหม่

            localStorage.setItem(
                "equipment_users",
                JSON.stringify(users)
            );


            // แจ้งเตือน

            alert(
                "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง"
            );


            // กลับหน้า Login

            window.location.href =
                "index.html";

        }
    );

}
    /* ========================================
       แสดง / ซ่อน รหัสผ่านหลัก
       ใช้ได้ทั้ง Login และ Register
    ======================================== */

    const togglePassword =
        document.getElementById("togglePassword");

    const password =
        document.getElementById("password");


    if (togglePassword && password) {

        togglePassword.addEventListener("click", function () {

            if (password.type === "password") {

                password.type = "text";
                togglePassword.textContent = "ซ่อน";

            } else {

                password.type = "password";
                togglePassword.textContent = "แสดง";

            }
            /* ========================================
   ลืมรหัสผ่าน
======================================== */

const forgotPasswordForm =
    document.getElementById("forgotPasswordForm");


if (forgotPasswordForm) {

    forgotPasswordForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const forgotEmail =
                document
                    .getElementById("forgotEmail")
                    .value
                    .trim()
                    .toLowerCase();


            // ดึงข้อมูลสมาชิก

            let users =
                JSON.parse(
                    localStorage.getItem("equipment_users")
                );


            if (!users) {

                users = [];

            }


            // ค้นหาอีเมล

            const userIndex =
                users.findIndex(
                    function (user) {

                        return (
                            user.email
                                .toLowerCase()
                            ===
                            forgotEmail
                        );

                    }
                );


            // ไม่พบอีเมล

            if (userIndex === -1) {

                alert(
                    "ไม่พบอีเมลนี้ในระบบ กรุณาตรวจสอบอีกครั้ง"
                );

                return;

            }


            // บันทึกอีเมลสำหรับรีเซ็ตรหัสผ่าน

            localStorage.setItem(
                "resetPasswordEmail",
                forgotEmail
            );


            alert(
                "ตรวจสอบอีเมลเรียบร้อย กรุณาตั้งรหัสผ่านใหม่"
            );


            // ไปหน้า Reset Password

            window.location.href =
                "reset-password.html";

        }
    );

}
/* ========================================
   ตรวจสอบเงื่อนไขรหัสผ่านใหม่
======================================== */

const newPasswordInput =
    document.getElementById("newPassword");


if (newPasswordInput) {

    newPasswordInput.addEventListener(
        "input",
        function () {

            const passwordValue =
                newPasswordInput.value;


            const ruleLength =
                document.getElementById(
                    "resetRuleLength"
                );


            const ruleUppercase =
                document.getElementById(
                    "resetRuleUppercase"
                );


            const ruleLowercase =
                document.getElementById(
                    "resetRuleLowercase"
                );


            const ruleNumber =
                document.getElementById(
                    "resetRuleNumber"
                );


            if (ruleLength) {

                ruleLength.className =
                    passwordValue.length >= 8
                        ? "rule-valid"
                        : "rule-invalid";

            }


            if (ruleUppercase) {

                ruleUppercase.className =
                    /[A-Z]/.test(passwordValue)
                        ? "rule-valid"
                        : "rule-invalid";

            }


            if (ruleLowercase) {

                ruleLowercase.className =
                    /[a-z]/.test(passwordValue)
                        ? "rule-valid"
                        : "rule-invalid";

            }


            if (ruleNumber) {

                ruleNumber.className =
                    /[0-9]/.test(passwordValue)
                        ? "rule-valid"
                        : "rule-invalid";

            }

        }
    );

}
/* ========================================
   แสดง / ซ่อนรหัสผ่านใหม่
======================================== */

const toggleNewPassword =
    document.getElementById("toggleNewPassword");

const newPassword =
    document.getElementById("newPassword");


if (toggleNewPassword && newPassword) {

    toggleNewPassword.addEventListener(
        "click",
        function () {

            if (newPassword.type === "password") {

                newPassword.type = "text";

                toggleNewPassword.textContent =
                    "ซ่อน";

            } else {

                newPassword.type = "password";

                toggleNewPassword.textContent =
                    "แสดง";

            }

        }
    );

}
/* ========================================
   แสดง / ซ่อนยืนยันรหัสผ่านใหม่
======================================== */

const toggleConfirmNewPassword =
    document.getElementById(
        "toggleConfirmNewPassword"
    );

const confirmNewPassword =
    document.getElementById(
        "confirmNewPassword"
    );


if (
    toggleConfirmNewPassword
    &&
    confirmNewPassword
) {

    toggleConfirmNewPassword.addEventListener(
        "click",
        function () {

            if (
                confirmNewPassword.type ===
                "password"
            ) {

                confirmNewPassword.type =
                    "text";

                toggleConfirmNewPassword.textContent =
                    "ซ่อน";

            } else {

                confirmNewPassword.type =
                    "password";

                toggleConfirmNewPassword.textContent =
                    "แสดง";

            }

        }
    );

}
/* ========================================
   บันทึกรหัสผ่านใหม่
======================================== */

const resetPasswordForm =
    document.getElementById("resetPasswordForm");


if (resetPasswordForm) {

    resetPasswordForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const newPasswordValue =
                document
                    .getElementById("newPassword")
                    .value;


            const confirmPasswordValue =
                document
                    .getElementById(
                        "confirmNewPassword"
                    )
                    .value;


            // ========================================
            // ตรวจสอบเงื่อนไขรหัสผ่าน
            // ========================================

            if (newPasswordValue.length < 8) {

                alert(
                    "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
                );

                return;

            }


            if (!/[A-Z]/.test(newPasswordValue)) {

                alert(
                    "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่อย่างน้อย 1 ตัว"
                );

                return;

            }


            if (!/[a-z]/.test(newPasswordValue)) {

                alert(
                    "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็กอย่างน้อย 1 ตัว"
                );

                return;

            }


            if (!/[0-9]/.test(newPasswordValue)) {

                alert(
                    "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"
                );

                return;

            }


            // ตรวจสอบรหัสผ่านตรงกัน

            if (
                newPasswordValue !==
                confirmPasswordValue
            ) {

                alert(
                    "รหัสผ่านทั้งสองช่องไม่ตรงกัน"
                );

                return;

            }


            // ========================================
            // ดึงอีเมลที่ต้องการ Reset
            // ========================================

            const resetEmail =
                localStorage.getItem(
                    "resetPasswordEmail"
                );


            if (!resetEmail) {

                alert(
                    "ไม่พบข้อมูลการรีเซ็ตรหัสผ่าน กรุณาเริ่มใหม่อีกครั้ง"
                );


                window.location.href =
                    "forgot-password.html";


                return;

            }


            // ========================================
            // ดึงข้อมูลสมาชิก
            // ========================================

            let users =
                JSON.parse(
                    localStorage.getItem(
                        "equipment_users"
                    )
                );


            if (!users) {

                users = [];

            }


            // ค้นหาผู้ใช้

            const userIndex =
                users.findIndex(
                    function (user) {

                        return (
                            user.email
                                .toLowerCase()
                            ===
                            resetEmail
                                .toLowerCase()
                        );

                    }
                );


            if (userIndex === -1) {

                alert(
                    "ไม่พบข้อมูลผู้ใช้งาน"
                );

                return;

            }


            // ========================================
            // เปลี่ยนรหัสผ่าน
            // ========================================

            users[userIndex].password =
                newPasswordValue;


            // บันทึกข้อมูลใหม่

            localStorage.setItem(
                "equipment_users",
                JSON.stringify(users)
            );


            // ลบข้อมูล Reset

            localStorage.removeItem(
                "resetPasswordEmail"
            );


            alert(
                "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่"
            );


            // กลับหน้า Login

            window.location.href =
                "index.html";

        }
    );

}


        });

    }


    /* ========================================
       แสดง / ซ่อน ยืนยันรหัสผ่าน
       ใช้เฉพาะหน้า Register
    ======================================== */

    const toggleConfirmPassword =
        document.getElementById("toggleConfirmPassword");

    const confirmPasswordInput =
        document.getElementById("confirmPassword");


    if (toggleConfirmPassword && confirmPasswordInput) {

        toggleConfirmPassword.addEventListener(
            "click",
            function () {

                if (confirmPasswordInput.type === "password") {

                    confirmPasswordInput.type = "text";

                    toggleConfirmPassword.textContent =
                        "ซ่อน";

                } else {

                    confirmPasswordInput.type =
                        "password";

                    toggleConfirmPassword.textContent =
                        "แสดง";

                }

            }
        );

    }


    /* ========================================
       ตรวจสอบเงื่อนไขรหัสผ่านขณะพิมพ์
       ใช้เฉพาะหน้า Register
    ======================================== */

    if (password) {

        password.addEventListener(
            "input",
            function () {

                const passwordValue =
                    password.value;


                const ruleLength =
                    document.getElementById(
                        "ruleLength"
                    );

                const ruleUppercase =
                    document.getElementById(
                        "ruleUppercase"
                    );

                const ruleLowercase =
                    document.getElementById(
                        "ruleLowercase"
                    );

                const ruleNumber =
                    document.getElementById(
                        "ruleNumber"
                    );


                // ตรวจสอบความยาว
                if (ruleLength) {

                    if (passwordValue.length >= 8) {

                        ruleLength.className =
                            "rule-valid";

                    } else {

                        ruleLength.className =
                            "rule-invalid";

                    }

                }


                // ตรวจสอบตัวพิมพ์ใหญ่
                if (ruleUppercase) {

                    if (/[A-Z]/.test(passwordValue)) {

                        ruleUppercase.className =
                            "rule-valid";

                    } else {

                        ruleUppercase.className =
                            "rule-invalid";

                    }

                }


                // ตรวจสอบตัวพิมพ์เล็ก
                if (ruleLowercase) {

                    if (/[a-z]/.test(passwordValue)) {

                        ruleLowercase.className =
                            "rule-valid";

                    } else {

                        ruleLowercase.className =
                            "rule-invalid";

                    }

                }


                // ตรวจสอบตัวเลข
                if (ruleNumber) {

                    if (/[0-9]/.test(passwordValue)) {

                        ruleNumber.className =
                            "rule-valid";

                    } else {

                        ruleNumber.className =
                            "rule-invalid";

                    }

                }

            }
        );

    }


    /* ========================================
       โหลดข้อมูลอีเมลที่จดจำไว้
       ใช้เฉพาะหน้า Login
    ======================================== */

    const email =
        document.getElementById("email");

    const rememberMe =
        document.getElementById("rememberMe");


    if (email && rememberMe) {

        const savedEmail =
            localStorage.getItem(
                "rememberedEmail"
            );


        if (savedEmail) {

            email.value = savedEmail;

            rememberMe.checked = true;

        }

    }


    /* ========================================
       REGISTER
    ======================================== */

    const registerForm =
        document.getElementById("registerForm");


    if (registerForm) {

        registerForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                /* รับข้อมูลจากฟอร์ม */

                const nameInput =
                    document.getElementById("name");


                const emailInput =
                    document.getElementById("email");


                const passwordInput =
                    document.getElementById("password");


                const confirmPassword =
                    document.getElementById(
                        "confirmPassword"
                    );


                const name =
                    nameInput.value.trim();


                const registerEmail =
                    emailInput.value.trim();


                const registerPassword =
                    passwordInput.value;


                const confirmPasswordValue =
                    confirmPassword.value;


                /* ========================================
                   ตรวจสอบชื่อ
                ======================================== */

                if (name === "") {

                    alert(
                        "กรุณากรอกชื่อ-นามสกุล"
                    );

                    return;

                }


                /* ========================================
                   ตรวจสอบความยาวรหัสผ่าน
                ======================================== */

                if (registerPassword.length < 8) {

                    alert(
                        "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
                    );

                    return;

                }


                /* ========================================
                   ตรวจสอบตัวพิมพ์ใหญ่
                ======================================== */

                if (!/[A-Z]/.test(registerPassword)) {

                    alert(
                        "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว"
                    );

                    return;

                }


                /* ========================================
                   ตรวจสอบตัวพิมพ์เล็ก
                ======================================== */

                if (!/[a-z]/.test(registerPassword)) {

                    alert(
                        "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวพิมพ์เล็กอย่างน้อย 1 ตัว"
                    );

                    return;

                }


                /* ========================================
                   ตรวจสอบตัวเลข
                ======================================== */

                if (!/[0-9]/.test(registerPassword)) {

                    alert(
                        "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"
                    );

                    return;

                }


                /* ========================================
                   ตรวจสอบรหัสผ่านตรงกัน
                ======================================== */

                if (
                    registerPassword !==
                    confirmPasswordValue
                ) {

                    alert(
                        "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"
                    );

                    return;

                }


                /* ========================================
                   ดึงข้อมูลสมาชิกเดิม
                ======================================== */

                let users =
                    JSON.parse(
                        localStorage.getItem(
                            "equipment_users"
                        )
                    );


                if (!users) {

                    users = [];

                }


                /* ========================================
                   ตรวจสอบอีเมลซ้ำ
                ======================================== */

                const existingUser =
                    users.find(function (user) {

                        return (
                            user.email ===
                            registerEmail
                        );

                    });


                if (existingUser) {

                    alert(
                        "อีเมลนี้ถูกใช้งานแล้ว"
                    );

                    return;

                }


                /* ========================================
                   สร้างผู้ใช้ใหม่
                ======================================== */

                const newUser = {

                    name: name,

                    email: registerEmail,

                    password: registerPassword

                };


                /* เพิ่มผู้ใช้ */

                users.push(newUser);


                /* บันทึกลง LocalStorage */

                localStorage.setItem(

                    "equipment_users",

                    JSON.stringify(users)

                );


                alert(
                    "ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ"
                );


                /* ไปหน้า Login */

                window.location.href =
                    "index.html";

            }
        );

    }


    /* ========================================
       LOGIN
    ======================================== */

    const loginForm =
        document.getElementById("loginForm");


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                /* รับข้อมูล */

                const loginEmail =
                    document.getElementById(
                        "email"
                    ).value.trim();


                const loginPassword =
                    document.getElementById(
                        "password"
                    ).value;


                /* ดึงข้อมูลผู้ใช้ */

                let users =
                    JSON.parse(
                        localStorage.getItem(
                            "equipment_users"
                        )
                    );


                if (!users) {

                    users = [];

                }


                /* ค้นหาผู้ใช้ */

                const user =
                    users.find(function (item) {

                        return (

                            item.email === loginEmail

                            &&

                            item.password ===
                            loginPassword

                        );

                    });


                /* ไม่พบผู้ใช้ */

                if (!user) {

                    alert(
                        "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
                    );

                    return;

                }


                /* ========================================
                   จดจำอีเมล
                ======================================== */

                if (
                    rememberMe &&
                    rememberMe.checked
                ) {

                    localStorage.setItem(

                        "rememberedEmail",

                        loginEmail

                    );

                } else {

                    localStorage.removeItem(
                        "rememberedEmail"
                    );

                }


                /* ========================================
                   บันทึกผู้ใช้ปัจจุบัน
                ======================================== */

                localStorage.setItem(

                    "equipment_current_user",

                    JSON.stringify(user)

                );


                alert(
                    "เข้าสู่ระบบสำเร็จ"
                );


                /* ไปหน้า Dashboard */

                window.location.href =
                    "dashboard.html";

            }
        );

    }


    /* ========================================
       DASHBOARD
    ======================================== */

    const equipmentTable =
        document.getElementById(
            "equipmentTable"
        );


    if (equipmentTable) {


        /* ========================================
           ตรวจสอบผู้ใช้ที่ Login
        ======================================== */

        const currentUser =
            JSON.parse(

                localStorage.getItem(
                    "equipment_current_user"
                )

            );


        if (!currentUser) {

            alert(
                "กรุณาเข้าสู่ระบบก่อน"
            );


            window.location.href =
                "index.html";


            return;

        }


        /* ========================================
           แสดงชื่อผู้ใช้
        ======================================== */

        const userName =
            document.getElementById(
                "userName"
            );


        if (userName) {

            userName.textContent =

                currentUser.name

                ||

                currentUser.email;

        }


        /* ========================================
           ดึงข้อมูลอุปกรณ์
        ======================================== */

        let equipmentData =
            JSON.parse(

                localStorage.getItem(
                    "equipment_data"
                )

            );


        if (!equipmentData) {

            equipmentData = [];

        }


        /* ========================================
           คำนวณจำนวนอุปกรณ์
        ======================================== */

        const totalEquipment =
            equipmentData.length;


        const availableEquipment =
            equipmentData.filter(
                function (item) {

                    return (
                        item.status ===
                        "available"
                    );

                }
            ).length;


        const borrowedEquipment =
            equipmentData.filter(
                function (item) {

                    return (
                        item.status ===
                        "borrowed"
                    );

                }
            ).length;


        const unavailableEquipment =
            equipmentData.filter(
                function (item) {

                    return (
                        item.status ===
                        "unavailable"
                    );

                }
            ).length;


        /* ========================================
           แสดงจำนวนบน Dashboard
        ======================================== */

        const totalElement =
            document.getElementById(
                "totalEquipment"
            );


        if (totalElement) {

            totalElement.textContent =
                totalEquipment;

        }


        const availableElement =
            document.getElementById(
                "availableEquipment"
            );


        if (availableElement) {

            availableElement.textContent =
                availableEquipment;

        }


        const borrowedElement =
            document.getElementById(
                "borrowedEquipment"
            );


        if (borrowedElement) {

            borrowedElement.textContent =
                borrowedEquipment;

        }


        const unavailableElement =
            document.getElementById(
                "unavailableEquipment"
            );


        if (unavailableElement) {

            unavailableElement.textContent =
                unavailableEquipment;

        }


        /* ========================================
           แสดงข้อมูลในตาราง
        ======================================== */

        equipmentTable.innerHTML = "";


        if (equipmentData.length === 0) {

            equipmentTable.innerHTML = `

                <tr>

                    <td colspan="5">
                        ยังไม่มีข้อมูลอุปกรณ์
                    </td>

                </tr>

            `;

        }


        equipmentData.forEach(
            function (item) {


                let statusText = "";

                let statusClass = "";


                if (
                    item.status ===
                    "available"
                ) {

                    statusText =
                        "พร้อมใช้งาน";

                    statusClass =
                        "available";

                }


                else if (
                    item.status ===
                    "borrowed"
                ) {

                    statusText =
                        "กำลังถูกยืม";

                    statusClass =
                        "borrowed";

                }


                else {

                    statusText =
                        "ไม่พร้อมใช้งาน";

                    statusClass =
                        "unavailable";

                }


                const borrowerName =
                    item.borrower || "-";


                const row =
                    document.createElement("tr");


                row.innerHTML = `

                    <td>
                        ${item.id}
                    </td>

                    <td>
                        ${item.name}
                    </td>

                    <td>
                        ${item.category}
                    </td>

                    <td>

                        <span
                            class="status ${statusClass}"
                        >

                            ${statusText}

                        </span>

                    </td>

                    <td>
                        ${borrowerName}
                    </td>

                `;


                equipmentTable.appendChild(
                    row
                );

            }
        );
// ========================================
// ค้นหาอุปกรณ์
// ========================================

const searchEquipment =
    document.getElementById(
        "searchEquipment"
    );


if (searchEquipment) {

    searchEquipment.addEventListener(
        "input",
        function () {

            const keyword =
                searchEquipment.value
                    .toLowerCase();


            const rows =
                equipmentTable.querySelectorAll(
                    "tr"
                );


            rows.forEach(
                function (row) {

                    const rowText =
                        row.textContent
                            .toLowerCase();


                    if (
                        rowText.includes(
                            keyword
                        )
                    ) {

                        row.style.display =
                            "";

                    } else {

                        row.style.display =
                            "none";

                    }

                }
            );

        }
    );

}

        /* ========================================
           Logout
        ======================================== */

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                function () {


                    localStorage.removeItem(
                        "equipment_current_user"
                    );


                    window.location.href =
                        "index.html";

                }
            );

        }

    }
// ========================================
// DASHBOARD
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {


        const equipmentTable =
            document.getElementById(
                "equipmentTable"
            );


        // ถ้าไม่ใช่หน้า Dashboard
        if (!equipmentTable) {

            return;

        }


        // ========================================
        // ตรวจสอบผู้ใช้งาน
        // ========================================

        const currentUser =
            JSON.parse(
                localStorage.getItem(
                    "equipment_current_user"
                )
            );


        // ถ้ายังไม่ได้เข้าสู่ระบบ

        if (!currentUser) {

            alert(
                "กรุณาเข้าสู่ระบบก่อน"
            );


            window.location.href =
                "index.html";


            return;

        }


        // ========================================
        // แสดงชื่อผู้ใช้งาน
        // ========================================

        const userName =
            document.getElementById(
                "userName"
            );


        if (userName) {

            userName.textContent =
                currentUser.name ||
                currentUser.email;

        }


        // ========================================
        // ดึงข้อมูลอุปกรณ์
        // ========================================

        let equipmentData =
            JSON.parse(
                localStorage.getItem(
                    "equipment_data"
                )
            );


        if (!equipmentData) {

            equipmentData = [];

        }


        // ========================================
        // คำนวณจำนวนอุปกรณ์
        // ========================================

        const totalEquipment =
            equipmentData.length;


        const availableEquipment =
            equipmentData.filter(
                function (item) {

                    return (
                        item.status ===
                        "available"
                    );

                }
            ).length;


        const borrowedEquipment =
            equipmentData.filter(
                function (item) {

                    return (
                        item.status ===
                        "borrowed"
                    );

                }
            ).length;


        const unavailableEquipment =
            equipmentData.filter(
                function (item) {

                    return (
                        item.status ===
                        "unavailable"
                    );

                }
            ).length;


        // ========================================
        // แสดงสถิติ
        // ========================================

        document.getElementById(
            "totalEquipment"
        ).textContent =
            totalEquipment;


        document.getElementById(
            "availableEquipment"
        ).textContent =
            availableEquipment;


        document.getElementById(
            "borrowedEquipment"
        ).textContent =
            borrowedEquipment;


        document.getElementById(
            "unavailableEquipment"
        ).textContent =
            unavailableEquipment;


        // ========================================
        // แสดงข้อมูลในตาราง
        // ========================================

        equipmentTable.innerHTML = "";


        equipmentData.forEach(
            function (item) {


                let statusText = "";

                let statusClass = "";


                // พร้อมใช้งาน

                if (
                    item.status ===
                    "available"
                ) {

                    statusText =
                        "พร้อมใช้งาน";


                    statusClass =
                        "available";

                }


                // กำลังถูกยืม

                else if (
                    item.status ===
                    "borrowed"
                ) {

                    statusText =
                        "กำลังถูกยืม";


                    statusClass =
                        "borrowed";

                }


                // ไม่พร้อมใช้งาน

                else {

                    statusText =
                        "ไม่พร้อมใช้งาน";


                    statusClass =
                        "unavailable";

                }


                // ผู้ยืม

                const borrowerName =
                    item.borrower ||
                    "-";


                // สร้างแถว

                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML = `

                    <td>
                        ${item.id}
                    </td>


                    <td>
                        ${item.name}
                    </td>


                    <td>
                        ${item.category}
                    </td>


                    <td>

                        <span
                            class="status ${statusClass}"
                        >

                            ${statusText}

                        </span>

                    </td>


                    <td>
                        ${borrowerName}
                    </td>

                `;


                equipmentTable.appendChild(
                    row
                );


            }
        );


        // ========================================
        // ค้นหาอุปกรณ์
        // ========================================

        const searchEquipment =
            document.getElementById(
                "searchEquipment"
            );


        if (searchEquipment) {

            searchEquipment.addEventListener(
                "input",
                function () {


                    const keyword =
                        this.value
                            .toLowerCase()
                            .trim();


                    const rows =
                        equipmentTable.querySelectorAll(
                            "tr"
                        );


                    rows.forEach(
                        function (row) {


                            const text =
                                row.textContent
                                    .toLowerCase();


                            if (
                                text.includes(
                                    keyword
                                )
                            ) {

                                row.style.display =
                                    "";


                            } else {

                                row.style.display =
                                    "none";

                            }


                        }
                    );


                }
            );

        }


        // ========================================
        // ออกจากระบบ
        // ========================================

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                function () {


                    localStorage.removeItem(
                        "equipment_current_user"
                    );


                    window.location.href =
                        "index.html";


                }
            );

        }


    }
);
/* ========================================
   PROFILE SYSTEM
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {


        const profileButton =
            document.getElementById(
                "profileButton"
            );


        const profileModal =
            document.getElementById(
                "profileModal"
            );


        const closeProfileModal =
            document.getElementById(
                "closeProfileModal"
            );


        const profileImageInput =
            document.getElementById(
                "profileImageInput"
            );


        const profilePreview =
            document.getElementById(
                "profilePreview"
            );


        const profileImage =
            document.getElementById(
                "profileImage"
            );


        const profileNameInput =
            document.getElementById(
                "profileNameInput"
            );


        const saveProfileButton =
            document.getElementById(
                "saveProfileButton"
            );


        /* ========================================
           โหลดข้อมูลโปรไฟล์
        ======================================== */

        let profileData =
            JSON.parse(
                localStorage.getItem(
                    "equipment_profile"
                )
            );


        if (!profileData) {

            profileData = {};

        }


        /* แสดงชื่อ */

        const userName =
            document.getElementById(
                "userName"
            );


        const welcomeUserName =
            document.getElementById(
                "welcomeUserName"
            );


        if (profileData.name) {

            if (userName) {

                userName.textContent =
                    profileData.name;

            }


            if (welcomeUserName) {

                welcomeUserName.textContent =
                    profileData.name;

            }

        }


        /* แสดงรูป */

        if (profileData.image) {

            if (profileImage) {

                profileImage.src =
                    profileData.image;

            }

        }


        /* ========================================
           เปิดหน้าต่าง Profile
        ======================================== */

        if (profileButton) {

            profileButton.addEventListener(
                "click",
                function () {


                    profileModal.classList.add(
                        "show"
                    );


                    if (profileData.name) {

                        profileNameInput.value =
                            profileData.name;

                    }


                    if (profileData.image) {

                        profilePreview.src =
                            profileData.image;

                    }

                }
            );

        }


        /* ========================================
           ปิด Modal
        ======================================== */

        if (closeProfileModal) {

            closeProfileModal.addEventListener(
                "click",
                function () {

                    profileModal.classList.remove(
                        "show"
                    );

                }
            );

        }


        /* ========================================
           เลือกรูปโปรไฟล์
        ======================================== */

        if (profileImageInput) {

            profileImageInput.addEventListener(
                "change",
                function () {


                    const file =
                        this.files[0];


                    if (!file) {

                        return;

                    }


                    const reader =
                        new FileReader();


                    reader.onload =
                        function (event) {

                            profilePreview.src =
                                event.target.result;


                            profileData.image =
                                event.target.result;

                        };


                    reader.readAsDataURL(
                        file
                    );

                }
            );

        }


        /* ========================================
           บันทึก Profile
        ======================================== */

        if (saveProfileButton) {

            saveProfileButton.addEventListener(
                "click",
                function () {


                    const newName =
                        profileNameInput.value.trim();


                    if (!newName) {

                        alert(
                            "กรุณากรอกชื่อผู้ใช้งาน"
                        );

                        return;

                    }


                    profileData.name =
                        newName;


                    /* บันทึก */

                    localStorage.setItem(
                        "equipment_profile",

                        JSON.stringify(
                            profileData
                        )
                    );


                    /* เปลี่ยนชื่อ */

                    if (userName) {

                        userName.textContent =
                            newName;

                    }


                    if (welcomeUserName) {

                        welcomeUserName.textContent =
                            newName;

                    }


                    /* เปลี่ยนรูป */

                    if (
                        profileData.image &&
                        profileImage
                    ) {

                        profileImage.src =
                            profileData.image;

                    }


                    alert(
                        "บันทึกข้อมูลสำเร็จ"
                    );


                    profileModal.classList.remove(
                        "show"
                    );

                }
            );

        }

    }
);
/* ========================================
   NOTIFICATION SYSTEM
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {


        const notificationButton =
            document.getElementById(
                "notificationButton"
            );


        const notificationPanel =
            document.getElementById(
                "notificationPanel"
            );


        const notificationList =
            document.getElementById(
                "notificationList"
            );


        const notificationCount =
            document.getElementById(
                "notificationCount"
            );


        if (
            !notificationButton ||
            !notificationPanel
        ) {

            return;

        }


        /* ========================================
           เปิด / ปิด กล่องแจ้งเตือน
        ======================================== */

        notificationButton.addEventListener(
            "click",
            function () {

                notificationPanel.classList.toggle(
                    "show"
                );

            }
        );


        /* ========================================
           โหลดข้อมูลแจ้งเตือน
        ======================================== */

        let notifications =
            JSON.parse(
                localStorage.getItem(
                    "equipment_notifications"
                )
            );


        if (!notifications) {

            notifications = [];

        }


        /* ========================================
           แสดง Notification
        ======================================== */

        function renderNotifications() {


            notificationList.innerHTML =
                "";


            if (
                notifications.length === 0
            ) {

                notificationList.innerHTML =
                    `
                    <p class="empty-notification">

                        ยังไม่มีการแจ้งเตือน

                    </p>
                    `;


                notificationCount.textContent =
                    "0";


                return;

            }


            notificationCount.textContent =
                notifications.length;


            notifications.forEach(
                function (notification) {


                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "notification-item";


                    item.textContent =
                        notification.message;


                    notificationList.appendChild(
                        item
                    );

                }
            );

        }


        renderNotifications();

    }
);
/* =========================================
   DASHBOARD SYSTEM
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {


        /* =====================================
           ตรวจสอบว่าอยู่หน้า Dashboard หรือไม่
        ===================================== */

        const equipmentTable =
            document.getElementById(
                "equipmentTable"
            );


        if (!equipmentTable) {
            return;
        }


        /* =====================================
           ข้อมูลผู้ใช้งาน
        ===================================== */

        let userName =
            localStorage.getItem(
                "loggedInUserName"
            );


        if (!userName) {

            userName =
                localStorage.getItem(
                    "userName"
                );

        }


        if (!userName) {

            userName =
                "ผู้ใช้งาน";

        }


        const userNameElement =
            document.getElementById(
                "userName"
            );


        const welcomeUserName =
            document.getElementById(
                "welcomeUserName"
            );


        if (userNameElement) {

            userNameElement.textContent =
                userName;

        }


        if (welcomeUserName) {

            welcomeUserName.textContent =
                userName;

        }


        /* =====================================
           ข้อมูลอุปกรณ์
        ===================================== */

        let equipmentData = [];


        const savedEquipment =
            localStorage.getItem(
                "equipmentData"
            );


        if (savedEquipment) {

            equipmentData =
                JSON.parse(
                    savedEquipment
                );

        } else {


            /* ข้อมูลตัวอย่าง */

            equipmentData = [

                {
                    id: "EQ001",
                    name:
                        "Projector Epson EB-X05",
                    category:
                        "เครื่องฉายภาพ",
                    status:
                        "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ002",
                    name:
                        "กล้อง Canon EOS",
                    category:
                        "กล้องถ่ายรูป",
                    status:
                        "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ003",
                    name:
                        "โน้ตบุ๊ก Lenovo",
                    category:
                        "คอมพิวเตอร์",
                    status:
                        "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ004",
                    name:
                        "สาย HDMI",
                    category:
                        "อุปกรณ์เสริม",
                    status:
                        "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ005",
                    name:
                        "ไมโครโฟน",
                    category:
                        "อุปกรณ์เสียง",
                    status:
                        "พร้อมใช้งาน",
                    borrower: "-"
                }

            ];


            localStorage.setItem(
                "equipmentData",
                JSON.stringify(
                    equipmentData
                )
            );

        }


        /* =====================================
           แสดงข้อมูลในตาราง
        ===================================== */

        function renderEquipment(
            data
        ) {


            equipmentTable.innerHTML =
                "";


            data.forEach(
                function (
                    equipment
                ) {


                    const row =
                        document.createElement(
                            "tr"
                        );


                    row.innerHTML =
                        `

                        <td>
                            ${equipment.id}
                        </td>

                        <td>
                            ${equipment.name}
                        </td>

                        <td>
                            ${equipment.category}
                        </td>

                        <td>
                            ${equipment.status}
                        </td>

                        <td>
                            ${equipment.borrower}
                        </td>

                        `;


                    equipmentTable.appendChild(
                        row
                    );

                }
            );


        }


        /* =====================================
           คำนวณสถิติ
        ===================================== */

        function updateStatistics() {


            const total =
                equipmentData.length;


            const available =
                equipmentData.filter(
                    function (
                        equipment
                    ) {

                        return (
                            equipment.status ===
                            "พร้อมใช้งาน"
                        );

                    }
                ).length;


            const borrowed =
                equipmentData.filter(
                    function (
                        equipment
                    ) {

                        return (
                            equipment.status ===
                            "กำลังถูกยืม"
                        );

                    }
                ).length;


            const unavailable =
                equipmentData.filter(
                    function (
                        equipment
                    ) {

                        return (
                            equipment.status ===
                            "ไม่พร้อมใช้งาน"
                        );

                    }
                ).length;


            const totalElement =
                document.getElementById(
                    "totalEquipment"
                );


            const availableElement =
                document.getElementById(
                    "availableEquipment"
                );


            const borrowedElement =
                document.getElementById(
                    "borrowedEquipment"
                );


            const unavailableElement =
                document.getElementById(
                    "unavailableEquipment"
                );


            if (totalElement) {

                totalElement.textContent =
                    total;

            }


            if (availableElement) {

                availableElement.textContent =
                    available;

            }


            if (borrowedElement) {

                borrowedElement.textContent =
                    borrowed;

            }


            if (unavailableElement) {

                unavailableElement.textContent =
                    unavailable;

            }

        }


        /* =====================================
           ค้นหาอุปกรณ์
        ===================================== */

        const searchInput =
            document.getElementById(
                "equipmentSearch"
            );


        if (searchInput) {


            searchInput.addEventListener(
                "input",
                function () {


                    const keyword =
                        searchInput.value
                        .toLowerCase();


                    const filteredData =
                        equipmentData.filter(
                            function (
                                equipment
                            ) {


                                return (

                                    equipment.name
                                    .toLowerCase()
                                    .includes(
                                        keyword
                                    )

                                    ||

                                    equipment.id
                                    .toLowerCase()
                                    .includes(
                                        keyword
                                    )

                                    ||

                                    equipment.category
                                    .toLowerCase()
                                    .includes(
                                        keyword
                                    )

                                );

                            }
                        );


                    renderEquipment(
                        filteredData
                    );


                }
            );


        }


        /* =====================================
           Notification
        ===================================== */

        const notificationButton =
            document.getElementById(
                "notificationButton"
            );


        const notificationPanel =
            document.getElementById(
                "notificationPanel"
            );


        if (
            notificationButton
            &&
            notificationPanel
        ) {


            notificationButton.addEventListener(
                "click",
                function () {


                    notificationPanel.classList.toggle(
                        "show"
                    );


                }
            );


        }


        /* =====================================
           ล้างการแจ้งเตือน
        ===================================== */

        const clearNotifications =
            document.getElementById(
                "clearNotifications"
            );


        if (
            clearNotifications
        ) {


            clearNotifications.addEventListener(
                "click",
                function () {


                    const notificationList =
                        document.getElementById(
                            "notificationList"
                        );


                    if (
                        notificationList
                    ) {


                        notificationList.innerHTML =
                            `

                            <p
                                class="
                                empty-notification
                                "
                            >

                                ยังไม่มีการแจ้งเตือน

                            </p>

                            `;

                    }


                    const notificationCount =
                        document.getElementById(
                            "notificationCount"
                        );


                    if (
                        notificationCount
                    ) {


                        notificationCount.textContent =
                            "0";

                    }


                }
            );


        }


        /* =====================================
           PROFILE
        ===================================== */

        const profileButton =
            document.getElementById(
                "profileButton"
            );


        const profileModal =
            document.getElementById(
                "profileModal"
            );


        const closeProfileModal =
            document.getElementById(
                "closeProfileModal"
            );


        if (
            profileButton
            &&
            profileModal
        ) {


            profileButton.addEventListener(
                "click",
                function () {


                    profileModal.classList.add(
                        "show"
                    );


                    const profileNameInput =
                        document.getElementById(
                            "profileNameInput"
                        );


                    if (
                        profileNameInput
                    ) {


                        profileNameInput.value =
                            userName;

                    }


                }
            );


        }


        if (
            closeProfileModal
            &&
            profileModal
        ) {


            closeProfileModal.addEventListener(
                "click",
                function () {


                    profileModal.classList.remove(
                        "show"
                    );


                }
            );


        }


        /* =====================================
           เลือกรูปโปรไฟล์
        ===================================== */

        const profileUpload =
            document.getElementById(
                "profileUpload"
            );


        const profileFileInput =
            document.getElementById(
                "profileFileInput"
            );


        if (
            profileUpload
            &&
            profileFileInput
        ) {


            profileUpload.addEventListener(
                "click",
                function () {


                    profileFileInput.click();


                }
            );


        }


        if (
            profileFileInput
        ) {


            profileFileInput.addEventListener(
                "change",
                function () {


                    const file =
                        profileFileInput.files[0];


                    if (!file) {

                        return;

                    }


                    const reader =
                        new FileReader();


                    reader.onload =
                        function (
                            event
                        ) {


                            const image =
                                event.target.result;


                            const preview =
                                document.getElementById(
                                    "profilePreview"
                                );


                            const profileImage =
                                document.getElementById(
                                    "profileImage"
                                );


                            const placeholder =
                                document.getElementById(
                                    "profilePlaceholder"
                                );


                            if (preview) {

                                preview.src =
                                    image;

                                preview.style.display =
                                    "block";

                            }


                            if (
                                placeholder
                            ) {

                                placeholder.style.display =
                                    "none";

                            }


                            if (
                                profileImage
                            ) {


                                profileImage.innerHTML =
                                    `<img src="${image}">`;

                            }


                            localStorage.setItem(
                                "profileImage",
                                image
                            );


                        };


                    reader.readAsDataURL(
                        file
                    );


                }
            );


        }


        /* =====================================
           โหลดรูปโปรไฟล์เดิม
        ===================================== */

        const savedProfileImage =
            localStorage.getItem(
                "profileImage"
            );


        if (
            savedProfileImage
        ) {


            const profileImage =
                document.getElementById(
                    "profileImage"
                );


            if (
                profileImage
            ) {


                profileImage.innerHTML =
                    `<img src="${savedProfileImage}">`;

            }


        }


        /* =====================================
           บันทึกโปรไฟล์
        ===================================== */

        const saveProfileButton =
            document.getElementById(
                "saveProfileButton"
            );


        if (
            saveProfileButton
        ) {


            saveProfileButton.addEventListener(
                "click",
                function () {


                    const profileNameInput =
                        document.getElementById(
                            "profileNameInput"
                        );


                    if (
                        !profileNameInput
                    ) {

                        return;

                    }


                    const newName =
                        profileNameInput.value
                        .trim();


                    if (
                        newName === ""
                    ) {


                        alert(
                            "กรุณากรอกชื่อผู้ใช้งาน"
                        );


                        return;

                    }


                    userName =
                        newName;


                    localStorage.setItem(
                        "loggedInUserName",
                        newName
                    );


                    localStorage.setItem(
                        "userName",
                        newName
                    );


                    const userNameElement =
                        document.getElementById(
                            "userName"
                        );


                    const welcomeUserName =
                        document.getElementById(
                            "welcomeUserName"
                        );


                    if (
                        userNameElement
                    ) {


                        userNameElement.textContent =
                            newName;

                    }


                    if (
                        welcomeUserName
                    ) {


                        welcomeUserName.textContent =
                            newName;

                    }


                    profileModal.classList.remove(
                        "show"
                    );


                    alert(
                        "บันทึกข้อมูลเรียบร้อยแล้ว"
                    );


                }
            );


        }


        /* =====================================
           LOGOUT
        ===================================== */

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (
            logoutButton
        ) {


            logoutButton.addEventListener(
                "click",
                function () {


                    localStorage.removeItem(
                        "loggedInUserName"
                    );


                    window.location.href =
                        "index.html";


                }
            );


        }


        /* =====================================
           เริ่มต้นระบบ
        ===================================== */

        renderEquipment(
            equipmentData
        );


        updateStatistics();


    }
);
document.addEventListener(
    "DOMContentLoaded",
    function () {


        /* ================================
           เริ่มต้น Lucide Icons
        ================================ */

        if (
            typeof lucide !== "undefined"
        ) {

            lucide.createIcons();

        }


        /* ================================
           ข้อมูลอุปกรณ์
        ================================ */

        let equipmentList =
            JSON.parse(
                localStorage.getItem(
                    "equipment"
                )
            );


        /* ================================
           สร้างข้อมูลตัวอย่าง
        ================================ */

        if (
            !equipmentList
        ) {

            equipmentList = [

                {
                    id: "EQ001",
                    name: "Projector Epson EB-X05",
                    category: "เครื่องฉายภาพ",
                    status: "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ002",
                    name: "กล้อง Canon EOS",
                    category: "กล้องถ่ายรูป",
                    status: "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ003",
                    name: "โน้ตบุ๊ก Lenovo",
                    category: "คอมพิวเตอร์",
                    status: "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ004",
                    name: "สาย HDMI",
                    category: "อุปกรณ์เสริม",
                    status: "พร้อมใช้งาน",
                    borrower: "-"
                },

                {
                    id: "EQ005",
                    name: "ไมโครโฟนไร้สาย",
                    category: "อุปกรณ์เสียง",
                    status: "พร้อมใช้งาน",
                    borrower: "-"
                }

            ];


            localStorage.setItem(
                "equipment",
                JSON.stringify(
                    equipmentList
                )
            );

        }


        /* ================================
           Element
        ================================ */

        const equipmentTable =
            document.getElementById(
                "equipmentTable"
            );


        const totalEquipment =
            document.getElementById(
                "totalEquipment"
            );


        const availableEquipment =
            document.getElementById(
                "availableEquipment"
            );


        const borrowedEquipment =
            document.getElementById(
                "borrowedEquipment"
            );


        const unavailableEquipment =
            document.getElementById(
                "unavailableEquipment"
            );


        /* ================================
           แสดงสถิติ
        ================================ */

        function updateStatistics() {


            const total =
                equipmentList.length;


            const available =
                equipmentList.filter(
                    function (item) {

                        return (
                            item.status ===
                            "พร้อมใช้งาน"
                        );

                    }
                ).length;


            const borrowed =
                equipmentList.filter(
                    function (item) {

                        return (
                            item.status ===
                            "กำลังถูกยืม"
                        );

                    }
                ).length;


            const unavailable =
                equipmentList.filter(
                    function (item) {

                        return (
                            item.status ===
                            "ไม่พร้อมใช้งาน"
                        );

                    }
                ).length;


            totalEquipment.textContent =
                total;


            availableEquipment.textContent =
                available;


            borrowedEquipment.textContent =
                borrowed;


            unavailableEquipment.textContent =
                unavailable;

        }


        /* ================================
           สร้างสีสถานะ
        ================================ */

        function getStatusClass(
            status
        ) {


            if (
                status ===
                "พร้อมใช้งาน"
            ) {

                return "status-available";

            }


            if (
                status ===
                "กำลังถูกยืม"
            ) {

                return "status-borrowed";

            }


            return "status-unavailable";

        }


        /* ================================
           แสดงตาราง
        ================================ */

        function displayEquipment(
            data
        ) {


            equipmentTable.innerHTML =
                "";


            if (
                data.length === 0
            ) {


                equipmentTable.innerHTML =
                    `
                    <tr>

                        <td
                            colspan="6"
                            style="
                                text-align: center;
                                padding: 30px;
                            "
                        >

                            ไม่พบอุปกรณ์ที่ค้นหา

                        </td>

                    </tr>
                    `;


                return;

            }


            data.forEach(
                function (
                    item,
                    index
                ) {


                    const row =
                        document.createElement(
                            "tr"
                        );


                    row.innerHTML =
                        `

                        <td>
                            ${item.id}
                        </td>


                        <td>
                            ${item.name}
                        </td>


                        <td>
                            ${item.category}
                        </td>


                        <td>

                            <span
                                class="
                                    status
                                    ${getStatusClass(
                                        item.status
                                    )}
                                "
                            >

                                ${item.status}

                            </span>

                        </td>


                        <td>

                            ${item.borrower || "-"}

                        </td>


                        <td>

                            <div
                                class="action-buttons"
                            >


                                <button
                                    class="
                                        action-button
                                        view-button
                                    "
                                    data-index="${index}"
                                >

                                    <i
                                        data-lucide="eye"
                                    ></i>

                                    ดูข้อมูล

                                </button>


                                <button
                                    class="
                                        action-button
                                        edit-button
                                    "
                                    data-index="${index}"
                                >

                                    <i
                                        data-lucide="pencil"
                                    ></i>

                                    แก้ไข

                                </button>


                            </div>

                        </td>

                        `;


                    equipmentTable.appendChild(
                        row
                    );


                }
            );


            lucide.createIcons();


            addActionEvents();

        }


        /* ================================
           ค้นหาอุปกรณ์
        ================================ */

        function searchEquipment(
            keyword
        ) {


            keyword =
                keyword
                    .toLowerCase()
                    .trim();


            const result =
                equipmentList.filter(
                    function (
                        item
                    ) {


                        return (

                            item.id
                                .toLowerCase()
                                .includes(
                                    keyword
                                )

                            ||

                            item.name
                                .toLowerCase()
                                .includes(
                                    keyword
                                )

                            ||

                            item.category
                                .toLowerCase()
                                .includes(
                                    keyword
                                )

                            ||

                            item.status
                                .toLowerCase()
                                .includes(
                                    keyword
                                )

                        );


                    }
                );


            displayEquipment(
                result
            );

        }


        /* ================================
           ช่องค้นหาด้านบน
        ================================ */

        const headerSearch =
            document.getElementById(
                "headerSearch"
            );


        if (
            headerSearch
        ) {


            headerSearch.addEventListener(
                "input",
                function () {


                    searchEquipment(
                        this.value
                    );


                    document
                        .getElementById(
                            "tableSearch"
                        )
                        .value =
                        this.value;


                }
            );

        }


        /* ================================
           ช่องค้นหาในตาราง
        ================================ */

        const tableSearch =
            document.getElementById(
                "tableSearch"
            );


        if (
            tableSearch
        ) {


            tableSearch.addEventListener(
                "input",
                function () {


                    searchEquipment(
                        this.value
                    );


                    document
                        .getElementById(
                            "headerSearch"
                        )
                        .value =
                        this.value;


                }
            );

        }


        /* ================================
           MODAL
        ================================ */

        const equipmentModal =
            document.getElementById(
                "equipmentModal"
            );


        const modalContent =
            document.getElementById(
                "modalContent"
            );


        const closeModal =
            document.getElementById(
                "closeModal"
            );


        /* ================================
           Event ปุ่มดูและแก้ไข
        ================================ */

        function addActionEvents() {


            /* ดูข้อมูล */

            const viewButtons =
                document.querySelectorAll(
                    ".view-button"
                );


            viewButtons.forEach(
                function (
                    button
                ) {


                    button.addEventListener(
                        "click",
                        function () {


                            const index =
                                this.dataset.index;


                            const item =
                                equipmentList[
                                    index
                                ];


                            modalContent.innerHTML =
                                `

                                <h2>
                                    ข้อมูลอุปกรณ์
                                </h2>


                                <div
                                    class="modal-info"
                                >


                                    <p>

                                        <strong>
                                            รหัสอุปกรณ์:
                                        </strong>

                                        ${item.id}

                                    </p>


                                    <p>

                                        <strong>
                                            ชื่ออุปกรณ์:
                                        </strong>

                                        ${item.name}

                                    </p>


                                    <p>

                                        <strong>
                                            ประเภท:
                                        </strong>

                                        ${item.category}

                                    </p>


                                    <p>

                                        <strong>
                                            สถานะ:
                                        </strong>

                                        ${item.status}

                                    </p>


                                    <p>

                                        <strong>
                                            ผู้ยืม:
                                        </strong>

                                        ${item.borrower || "-"}

                                    </p>


                                </div>

                                `;


                            equipmentModal.classList.add(
                                "show"
                            );


                        }
                    );


                }
            );


            /* แก้ไข */

            const editButtons =
                document.querySelectorAll(
                    ".edit-button"
                );


            editButtons.forEach(
                function (
                    button
                ) {


                    button.addEventListener(
                        "click",
                        function () {


                            const index =
                                this.dataset.index;


                            const item =
                                equipmentList[
                                    index
                                ];


                            const newName =
                                prompt(
                                    "ชื่ออุปกรณ์",
                                    item.name
                                );


                            if (
                                newName !== null
                            ) {


                                equipmentList[
                                    index
                                ].name =
                                    newName;


                                localStorage.setItem(
                                    "equipment",
                                    JSON.stringify(
                                        equipmentList
                                    )
                                );


                                displayEquipment(
                                    equipmentList
                                );


                                updateStatistics();

                            }


                        }
                    );


                }
            );

        }


        /* ================================
           ปิด Modal
        ================================ */

        if (
            closeModal
        ) {


            closeModal.addEventListener(
                "click",
                function () {


                    equipmentModal.classList.remove(
                        "show"
                    );


                }
            );

        }


        /* ================================
           PROFILE
        ================================ */

        const profileButton =
            document.getElementById(
                "profileButton"
            );


        const profileModal =
            document.getElementById(
                "profileModal"
            );


        const closeProfileModal =
            document.getElementById(
                "closeProfileModal"
            );


        const editUserName =
            document.getElementById(
                "editUserName"
            );


        const saveProfileButton =
            document.getElementById(
                "saveProfileButton"
            );


        const userName =
            document.getElementById(
                "userName"
            );


        /* โหลดชื่อผู้ใช้ */

        const savedUserName =
            localStorage.getItem(
                "userName"
            );


        if (
            savedUserName
        ) {

            userName.textContent =
                savedUserName;

        }


        /* เปิด Profile */

        if (
            profileButton
        ) {


            profileButton.addEventListener(
                "click",
                function () {


                    editUserName.value =
                        userName.textContent;


                    profileModal.classList.add(
                        "show"
                    );


                }
            );

        }


        /* บันทึก Profile */

        if (
            saveProfileButton
        ) {


            saveProfileButton.addEventListener(
                "click",
                function () {


                    const newUserName =
                        editUserName.value.trim();


                    if (
                        newUserName === ""
                    ) {

                        alert(
                            "กรุณากรอกชื่อผู้ใช้งาน"
                        );


                        return;

                    }


                    userName.textContent =
                        newUserName;


                    localStorage.setItem(
                        "userName",
                        newUserName
                    );


                    profileModal.classList.remove(
                        "show"
                    );


                }
            );

        }


        /* ปิด Profile */

        if (
            closeProfileModal
        ) {


            closeProfileModal.addEventListener(
                "click",
                function () {


                    profileModal.classList.remove(
                        "show"
                    );


                }
            );

        }


        /* ================================
           LOGOUT
        ================================ */

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (
            logoutButton
        ) {


            logoutButton.addEventListener(
                "click",
                function () {


                    const confirmLogout =
                        confirm(
                            "ต้องการออกจากระบบหรือไม่?"
                        );


                    if (
                        confirmLogout
                    ) {


                        window.location.href =
                            "login.html";


                    }


                }
            );

        }


        /* ================================
           เริ่มต้นระบบ
        ================================ */

        displayEquipment(
            equipmentList
        );


        updateStatistics();

<script src="app.js"></script>
    }
);
});