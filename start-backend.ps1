$env:DB_USERNAME="neondb_owner"
$env:DB_PASSWORD="npg_mvoIZ1ud4YDH"

$services = @(
    @{name="auth-service"; port=8081; db="vouch_auth"},
    @{name="notification-service"; port=8082; db="vouch_notifications"; extra=@{"AUTH_SERVICE_URL"="http://localhost:8081"}},
    @{name="loan-service"; port=8083; db="vouch_loans"; extra=@{"AUTH_SERVICE_URL"="http://localhost:8081";"NOTIFICATION_SERVICE_URL"="http://localhost:8082"}},
    @{name="payment-service"; port=8084; db="vouch_payments"; extra=@{"AUTH_SERVICE_URL"="http://localhost:8081";"LOAN_SERVICE_URL"="http://localhost:8083";"NOTIFICATION_SERVICE_URL"="http://localhost:8082"}},
    @{name="dispute-service"; port=8085; db="vouch_disputes"; extra=@{"AUTH_SERVICE_URL"="http://localhost:8081";"LOAN_SERVICE_URL"="http://localhost:8083";"NOTIFICATION_SERVICE_URL"="http://localhost:8082"}},
    @{name="expense-service"; port=8086; db="vouch_expenses"; extra=@{"AUTH_SERVICE_URL"="http://localhost:8081";"NOTIFICATION_SERVICE_URL"="http://localhost:8082"}},
    @{name="api-gateway"; port=8080; db=$null; extra=@{"AUTH_SERVICE_URL"="http://localhost:8081";"NOTIFICATION_SERVICE_URL"="http://localhost:8082";"LOAN_SERVICE_URL"="http://localhost:8083";"PAYMENT_SERVICE_URL"="http://localhost:8084";"DISPUTE_SERVICE_URL"="http://localhost:8085";"EXPENSE_SERVICE_URL"="http://localhost:8086"}}
)

foreach ($svc in $services) {
    $args = @{
        FilePath = "powershell"
        ArgumentList = "-NoExit", "-Command", "
            cd C:\Users\joey\vouch\$($svc.name);
            `$env:DB_USERNAME='neondb_owner';
            `$env:DB_PASSWORD='npg_mvoIZ1ud4YDH';
            $(if ($svc.db) { "`$env:DATABASE_URL='jdbc:postgresql://ep-green-glade-ab7073ah-pooler.eu-west-2.aws.neon.tech/$($svc.db)?sslmode=require&channel_binding=require';" })
            $(foreach ($k in $svc.extra.Keys) { "`$env:$k='$($svc.extra[$k])';" })
            mvn spring-boot:run
        "
    }
    Start-Process @args
    Start-Sleep -Seconds 2
}