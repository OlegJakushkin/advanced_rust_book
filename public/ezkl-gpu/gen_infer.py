"""Chapter 53 — the GPU-aware half of zkML.

Builds a small ONNX model, runs its inference on the GPU via ONNX Runtime's CUDA
execution provider (the GPU-accelerated inference that a zkML pipeline proves),
and writes input.json for EZKL. The model is deliberately small so the EZKL proof
that follows stays fast; the point here is that the inference runs on the device.
"""
import json, sys, numpy as np, onnx, onnxruntime as ort
from onnx import helper, numpy_helper, TensorProto

np.random.seed(0)
def gemm(i, a, b, ni, no):
    W = numpy_helper.from_array((np.random.randn(a, b) * 0.3).astype(np.float32), f"W{i}")
    B = numpy_helper.from_array(np.zeros(b, np.float32), f"B{i}")
    return helper.make_node("Gemm", [ni, f"W{i}", f"B{i}"], [no], name=f"g{i}"), [W, B]

n0, i0 = gemm(0, 4, 8, "input", "h0"); r0 = helper.make_node("Relu", ["h0"], ["h1"])
n1, i1 = gemm(1, 8, 8, "h1", "h2");    r1 = helper.make_node("Relu", ["h2"], ["h3"])
n2, i2 = gemm(2, 8, 2, "h3", "output")
g = helper.make_graph([n0, r0, n1, r1, n2], "zkml",
    [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 4])],
    [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 2])],
    initializer=i0 + i1 + i2)
m = helper.make_model(g, opset_imports=[helper.make_operatorsetid("", 13)]); m.ir_version = 9
onnx.save(m, "model.onnx")

inp = np.array([[0.5, -0.2, 0.1, 0.9]], dtype=np.float32)
json.dump({"input_data": inp.tolist()}, open("input.json", "w"))

sess = ort.InferenceSession("model.onnx", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
active = sess.get_providers()
print("ONNX Runtime providers:", active)
if "CUDAExecutionProvider" not in active:
    print("ERROR: CUDA execution provider not active — GPU not available to ONNX Runtime.")
    sys.exit(1)
out = sess.run(None, {"input": inp})[0]
print("GPU inference output:", [round(x, 4) for x in out.ravel().tolist()])
