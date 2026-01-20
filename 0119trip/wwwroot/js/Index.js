//function goToTrip(tripId) {
//    console.log("前往旅程:", tripId);
//    // 修改為 MVC 的路由路徑
//    window.location.href = '/Home/Detail';
//}
function goToTrip(tripId) {
    console.log("前往旅程 ID:", tripId);
    // 這裡改成帶參數的網址，例如 /Home/Detail?id=1
    window.location.href = '/Home/Detail?id=' + tripId;
}

function createNewTrip() {
    alert("建立新旅程功能開發中！");
}