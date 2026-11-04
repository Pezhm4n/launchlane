FROM mcr.microsoft.com/dotnet/sdk@sha256:9c7b6b263d9d4c2e4718e16dae6d75cd8f4b5ccf206f1e7d48a98eb429981b03 AS compiler
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY . .
RUN dotnet restore Orders.slnx --locked-mode --configfile NuGet.Config
RUN dotnet run --project Checks --configuration "$BUILD_CONFIGURATION" --no-restore
RUN dotnet publish Orders/Orders.csproj --configuration "$BUILD_CONFIGURATION" --no-restore --output /publish
FROM mcr.microsoft.com/dotnet/aspnet@sha256:43cbcf11fd6f88c0375c9c0f7fe59af619abeb323befe5f57dc1502b5a05d8c3
WORKDIR /app
COPY --from=compiler /publish/ ./
ENV ASPNETCORE_HTTP_PORTS=8080
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["dotnet","Orders.dll"]
