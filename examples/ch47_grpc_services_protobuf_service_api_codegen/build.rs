fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(
            &["examples/ch47_grpc_services_protobuf_service_api_codegen/billing.proto"],
            &["examples/ch47_grpc_services_protobuf_service_api_codegen"],
        )?;

    println!(
        "cargo:rerun-if-changed=examples/ch47_grpc_services_protobuf_service_api_codegen/billing.proto"
    );
    Ok(())
}
