from django.urls import path
from django.http import JsonResponse
from invoice import total
def orders(request):
    return JsonResponse({"total":total([{"price":17,"quantity":3},{"price":8,"quantity":0},{"price":11,"quantity":2}])})
urlpatterns = [path("orders",orders)]
