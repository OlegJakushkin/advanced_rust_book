use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

struct Formatter {
    prefix: String,
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_new(prefix: *const c_char) -> *mut Formatter {
    if prefix.is_null() {
        return ptr::null_mut();
    }

    let prefix = unsafe {
        // SAFETY:
        // - prefix was checked for null above.
        // - the caller promises a valid NUL-terminated string.
        CStr::from_ptr(prefix)
    };

    let Ok(prefix_text) = prefix.to_str() else {
        return ptr::null_mut();
    };

    Box::into_raw(Box::new(Formatter {
        prefix: prefix_text.to_string(),
    }))
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_format(
    formatter: *const Formatter,
    value: *const c_char,
) -> *mut c_char {
    if formatter.is_null() || value.is_null() {
        return ptr::null_mut();
    }

    let formatter = unsafe {
        // SAFETY:
        // - formatter was checked for null above.
        // - the caller promises it points to a live Formatter from formatter_new.
        &*formatter
    };

    let value = unsafe {
        // SAFETY:
        // - value was checked for null above.
        // - the caller promises a valid NUL-terminated string.
        CStr::from_ptr(value)
    };

    let Ok(value_text) = value.to_str() else {
        return ptr::null_mut();
    };

    let rendered = format!("{}::{}", formatter.prefix, value_text);
    match CString::new(rendered) {
        Ok(text) => text.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_string_free(text: *mut c_char) {
    if text.is_null() {
        return;
    }

    unsafe {
        // SAFETY:
        // - text must come from CString::into_raw in formatter_format.
        drop(CString::from_raw(text));
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn formatter_free(formatter: *mut Formatter) {
    if formatter.is_null() {
        return;
    }

    unsafe {
        // SAFETY:
        // - formatter must come from Box::into_raw in formatter_new.
        drop(Box::from_raw(formatter));
    }
}

fn main() {
    let prefix = CString::new("svc").unwrap();
    let value = CString::new("orders").unwrap();

    let formatter = formatter_new(prefix.as_ptr());
    let rendered = formatter_format(formatter, value.as_ptr());

    let text = unsafe { CStr::from_ptr(rendered) }.to_str().unwrap();
    println!("label = {}", text);

    formatter_string_free(rendered);
    formatter_free(formatter);
}
